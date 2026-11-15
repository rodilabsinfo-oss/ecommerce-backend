/**
 * Suppliers and what we owe them. A supplier is owed the wholesale price of
 * every item that was DELIVERED and not yet included in a payout.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../auth/auth.middleware.js';

const idParam = z.object({ id: z.string().uuid() });

/** Items we owe money for (delivered, not paid out). */
const owedItems = (storeId: string, supplierId?: string): Prisma.OrderItemWhereInput => ({
  supplierId: supplierId ?? { not: null },
  payoutId: null,
  order: { storeId, status: 'DELIVERED' },
});

async function owedBySupplier(storeId: string) {
  const items = await prisma.orderItem.findMany({
    where: owedItems(storeId),
    select: { supplierId: true, wholesalePrice: true, quantity: true },
  });
  const owed = new Map<string, { amount: number; items: number }>();
  for (const i of items) {
    const cur = owed.get(i.supplierId!) ?? { amount: 0, items: 0 };
    cur.amount += i.wholesalePrice * i.quantity;
    cur.items += i.quantity;
    owed.set(i.supplierId!, cur);
  }
  return owed;
}

// ─── Suppliers ─────────────────────────────────────────────────────────

export const supplierAdminRoutes = Router();
supplierAdminRoutes.use(requireRole('ADMIN'));

const fields = {
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
};

supplierAdminRoutes.get('/', async (req, res) => {
  const [rows, owed] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: req.store.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    owedBySupplier(req.store.id),
  ]);
  res.json({
    data: rows.map(({ _count, ...s }) => ({
      ...s,
      productCount: _count.products,
      owed: owed.get(s.id)?.amount ?? 0,
      owedItems: owed.get(s.id)?.items ?? 0,
    })),
  });
});

supplierAdminRoutes.post('/', validate({ body: z.object(fields) }), async (req, res) => {
  res.status(201).json({ data: await prisma.supplier.create({ data: { ...res.locals.input.body, storeId: req.store.id } }) });
});

supplierAdminRoutes.patch('/:id', validate({ params: idParam, body: z.object(fields).partial() }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  if (!(await prisma.supplier.findFirst({ where: { id, storeId: req.store.id } }))) throw AppError.notFound('Supplier not found');
  res.json({ data: await prisma.supplier.update({ where: { id }, data: res.locals.input.body }) });
});

/** Suppliers with payouts or sold items are deactivated, not deleted, to keep history. */
supplierAdminRoutes.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const s = await prisma.supplier.findFirst({
    where: { id, storeId: req.store.id },
    include: { _count: { select: { payouts: true, orderItems: true } } },
  });
  if (!s) throw AppError.notFound('Supplier not found');
  if (s._count.payouts || s._count.orderItems) {
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    res.json({ data: { deactivated: true } });
  } else {
    await prisma.supplier.delete({ where: { id } });
    res.json({ data: { deleted: true } });
  }
});

// ─── Payouts (owner only: this is money) ───────────────────────────────

export const payoutAdminRoutes = Router();
payoutAdminRoutes.use(requireRole('OWNER'));

payoutAdminRoutes.get('/', async (req, res) => {
  const rows = await prisma.supplierPayout.findMany({
    where: { storeId: req.store.id },
    orderBy: { createdAt: 'desc' },
    include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
  });
  res.json({ data: rows.map(({ _count, ...p }) => ({ ...p, itemCount: _count.items })) });
});

payoutAdminRoutes.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const p = await prisma.supplierPayout.findFirst({
    where: { id, storeId: req.store.id },
    include: {
      supplier: true,
      items: {
        select: {
          productName: true,
          variantTitle: true,
          sku: true,
          quantity: true,
          wholesalePrice: true,
          order: { select: { orderNumber: true, createdAt: true } },
        },
      },
    },
  });
  if (!p) throw AppError.notFound('Payout not found');
  res.json({ data: p });
});

/** Gathers everything currently owed to a supplier into one payout (to be paid). */
payoutAdminRoutes.post('/', validate({ body: z.object({ supplierId: z.string().uuid(), note: z.string().max(500).optional() }) }), async (req, res) => {
  const { supplierId, note } = res.locals.input.body as { supplierId: string; note?: string };
  if (!(await prisma.supplier.findFirst({ where: { id: supplierId, storeId: req.store.id } }))) {
    throw AppError.notFound('Supplier not found');
  }
  const payout = await prisma.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({
      where: owedItems(req.store.id, supplierId),
      select: { id: true, wholesalePrice: true, quantity: true },
    });
    if (!items.length) throw AppError.badRequest('Nothing is owed to this supplier right now');
    const amount = items.reduce((s, i) => s + i.wholesalePrice * i.quantity, 0);
    const p = await tx.supplierPayout.create({ data: { storeId: req.store.id, supplierId, amount, note } });
    // payoutId: null in the condition stops the same item landing in two payouts.
    const linked = await tx.orderItem.updateMany({
      where: { id: { in: items.map((i) => i.id) }, payoutId: null },
      data: { payoutId: p.id },
    });
    if (linked.count !== items.length) throw AppError.conflict('Items changed while preparing the payout. Try again.');
    return p;
  });
  res.status(201).json({ data: payout });
});

payoutAdminRoutes.post('/:id/paid', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const r = await prisma.supplierPayout.updateMany({
    where: { id, storeId: req.store.id, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date() },
  });
  if (!r.count) throw AppError.badRequest('Payout not found or already paid');
  res.status(204).end();
});

/** A pending payout can be cancelled; its items become "owed" again. */
payoutAdminRoutes.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const p = await prisma.supplierPayout.findFirst({ where: { id, storeId: req.store.id } });
  if (!p) throw AppError.notFound('Payout not found');
  if (p.status === 'PAID') throw AppError.badRequest('A paid payout cannot be cancelled');
  await prisma.$transaction([
    prisma.orderItem.updateMany({ where: { payoutId: id }, data: { payoutId: null } }),
    prisma.supplierPayout.delete({ where: { id } }),
  ]);
  res.status(204).end();
});
