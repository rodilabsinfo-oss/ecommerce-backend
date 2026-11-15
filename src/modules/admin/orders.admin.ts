import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { refreshProductSummary } from '../catalog/product.service.js';

export const orderAdminRoutes = Router();

/**
 * Which status can follow which. Anything else is refused, so an order
 * can't jump from "Pending" straight to "Delivered" by mistake.
 */
export const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const numberParam = z.object({ orderNumber: z.coerce.number().int().positive() });

// ─── List ──────────────────────────────────────────────────────────────

const listQuery = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
  q: z.string().trim().optional(), // order number, phone or name
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

orderAdminRoutes.get('/', validate({ query: listQuery }), async (req, res) => {
  const q = res.locals.input.query as z.infer<typeof listQuery>;
  const asNumber = q.q && /^\d{1,9}$/.test(q.q) ? Number(q.q) : undefined;
  const where: Prisma.OrderWhereInput = {
    storeId: req.store.id,
    status: q.status,
    createdAt: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
    ...(q.q
      ? {
          OR: [
            ...(asNumber ? [{ orderNumber: asNumber }] : []),
            { shipPhone: { contains: q.q.replace(/\D/g, '') || q.q } },
            { shipName: { contains: q.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [total, rows, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        shipName: true,
        shipPhone: true,
        shipDistrict: true,
        _count: { select: { items: true } },
      },
    }),
    // Numbers for the status tabs.
    prisma.order.groupBy({ by: ['status'], where: { storeId: req.store.id }, _count: { _all: true } }),
  ]);
  res.json({
    data: rows.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items })),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.ceil(total / q.limit),
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    },
  });
});

// ─── Detail ────────────────────────────────────────────────────────────

orderAdminRoutes.get('/:orderNumber', validate({ params: numberParam }), async (req, res) => {
  const { orderNumber } = res.locals.input.params as { orderNumber: number };
  const o = await prisma.order.findUnique({
    where: { storeId_orderNumber: { storeId: req.store.id, orderNumber } },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, _count: { select: { orders: true } } } },
      items: { include: { supplier: { select: { id: true, name: true } } } },
      payments: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' }, include: { staff: { select: { name: true } } } },
    },
  });
  if (!o) throw AppError.notFound('Order not found');
  res.json({ data: { ...o, nextStatuses: NEXT[o.status] } });
});

// ─── Status changes ────────────────────────────────────────────────────

const statusInput = z.object({
  status: z.enum(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']),
  note: z.string().trim().max(500).optional(),
});

orderAdminRoutes.post('/:orderNumber/status', validate({ params: numberParam, body: statusInput }), async (req, res) => {
  const { orderNumber } = res.locals.input.params as { orderNumber: number };
  const { status: to, note } = res.locals.input.body as z.infer<typeof statusInput>;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { storeId_orderNumber: { storeId: req.store.id, orderNumber } },
      include: { items: { select: { variantId: true, quantity: true } } },
    });
    if (!order) throw AppError.notFound('Order not found');
    if (!NEXT[order.status].includes(to)) {
      throw new AppError(409, 'BAD_STATUS_CHANGE', `An order that is ${order.status} cannot become ${to}`, {
        allowed: NEXT[order.status],
      });
    }

    // Guard against two staff changing the same order at once.
    const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: to } });
    if (moved.count !== 1) throw AppError.conflict('Someone else just changed this order. Reload and try again.');

    // Cancelled or returned: the clothes come back into stock.
    if (to === 'CANCELLED' || to === 'RETURNED') {
      const productIds = new Set<string>();
      for (const item of order.items) {
        if (!item.variantId) continue; // variant was deleted since
        const v = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
          select: { productId: true },
        });
        productIds.add(v.productId);
      }
      for (const id of productIds) await refreshProductSummary(tx, id);
    }

    // Cash on delivery: delivered means the rider collected the money.
    if (to === 'DELIVERED' && order.paymentMethod === 'COD') {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    }
    if (to === 'RETURNED' && order.paymentStatus === 'PAID') {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PAID' }, data: { status: 'REFUNDED' } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } });
    }
    if (to === 'CANCELLED') {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }

    await tx.orderEvent.create({
      data: { orderId: order.id, staffId: req.staff!.id, fromStatus: order.status, toStatus: to, note },
    });
    return { orderNumber, from: order.status, status: to, nextStatuses: NEXT[to] };
  });

  logger.info({ store: req.store.slug, orderNumber, from: result.from, to, by: req.staff!.email }, 'Order status changed');
  res.json({ data: result });
});

/** Internal note for the team (never shown to the buyer). */
orderAdminRoutes.patch(
  '/:orderNumber',
  validate({ params: numberParam, body: z.object({ staffNote: z.string().max(2000).nullable() }) }),
  async (req, res) => {
    const { orderNumber } = res.locals.input.params as { orderNumber: number };
    const r = await prisma.order.updateMany({
      where: { storeId: req.store.id, orderNumber },
      data: { staffNote: (res.locals.input.body as { staffNote: string | null }).staffNote },
    });
    if (!r.count) throw AppError.notFound('Order not found');
    res.status(204).end();
  },
);
