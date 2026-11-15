/** Dashboard numbers, customers, shop settings and staff accounts. */
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { passwordRule } from '../auth/auth.routes.js';
import { requireRole } from '../auth/auth.middleware.js';
import { clearStoreCache } from '../stores/store-context.js';
import { storeSettingsSchema } from '../stores/store-settings.js';

const idParam = z.object({ id: z.string().uuid() });
const LIVE: Prisma.OrderWhereInput['status'] = { notIn: ['CANCELLED', 'RETURNED'] };

// ─── Dashboard ─────────────────────────────────────────────────────────

export const dashboardAdminRoutes = Router();

dashboardAdminRoutes.get('/', async (req, res) => {
  const storeId = req.store.id;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days30 = new Date(now.getTime() - 30 * 86_400_000);
  const days14 = new Date(startOfToday.getTime() - 13 * 86_400_000);

  const [today, last30, byStatus, lowStock, top, daily] = await Promise.all([
    prisma.order.aggregate({ where: { storeId, createdAt: { gte: startOfToday }, status: LIVE }, _count: true, _sum: { total: true } }),
    prisma.order.aggregate({ where: { storeId, createdAt: { gte: days30 }, status: LIVE }, _count: true, _sum: { total: true } }),
    prisma.order.groupBy({ by: ['status'], where: { storeId }, _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { storeId, isActive: true, stock: { lte: 3 }, product: { status: 'ACTIVE' } },
      orderBy: { stock: 'asc' },
      take: 10,
      select: { id: true, sku: true, stock: true, product: { select: { id: true, name: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { storeId, createdAt: { gte: days30 }, status: LIVE } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    // Orders and sales per day for the last 14 days (Nepal time).
    prisma.$queryRaw<{ day: Date; orders: bigint; sales: bigint | null }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kathmandu') AS day,
             COUNT(*) AS orders, SUM("total") AS sales
      FROM "Order"
      WHERE "storeId" = ${storeId}::uuid AND "createdAt" >= ${days14}
        AND "status" NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY 1 ORDER BY 1`,
  ]);

  res.json({
    data: {
      today: { orders: today._count, sales: today._sum.total ?? 0 },
      last30Days: { orders: last30._count, sales: last30._sum.total ?? 0 },
      statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      toProcess: byStatus.filter((s) => ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(s.status)).reduce((n, s) => n + s._count._all, 0),
      lowStock,
      topProducts: top.map((t) => ({ name: t.productName, quantity: t._sum.quantity ?? 0, sales: t._sum.lineTotal ?? 0 })),
      daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), orders: Number(d.orders), sales: Number(d.sales ?? 0) })),
    },
  });
});

// ─── Customers ─────────────────────────────────────────────────────────

export const customerAdminRoutes = Router();

const customerQuery = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

customerAdminRoutes.get('/', validate({ query: customerQuery }), async (req, res) => {
  const q = res.locals.input.query as z.infer<typeof customerQuery>;
  const where: Prisma.CustomerWhereInput = {
    storeId: req.store.id,
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    }),
  ]);
  const stats = await prisma.order.groupBy({
    by: ['customerId'],
    where: { customerId: { in: rows.map((r) => r.id) }, status: LIVE },
    _count: { _all: true },
    _sum: { total: true },
    _max: { createdAt: true },
  });
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  res.json({
    data: rows.map((c) => ({
      ...c,
      orders: byId.get(c.id)?._count._all ?? 0,
      spent: byId.get(c.id)?._sum.total ?? 0,
      lastOrderAt: byId.get(c.id)?._max.createdAt ?? null,
    })),
    meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

customerAdminRoutes.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const c = await prisma.customer.findFirst({
    where: { id, storeId: req.store.id },
    include: {
      addresses: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true, createdAt: true, status: true, total: true },
      },
    },
  });
  if (!c) throw AppError.notFound('Customer not found');
  res.json({ data: c });
});

// ─── Shop settings (owner) ─────────────────────────────────────────────

export const settingsAdminRoutes = Router();
settingsAdminRoutes.use(requireRole('OWNER'));

settingsAdminRoutes.get('/', async (req, res) => {
  const s = await prisma.store.findUniqueOrThrow({ where: { id: req.store.id } });
  res.json({ data: { name: s.name, slug: s.slug, domain: s.domain, currency: s.currency, settings: storeSettingsSchema.parse(s.settings ?? {}) } });
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Patch only what was sent: { theme: { preset: 'bloom' } } keeps every other setting. */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Record<string, unknown>, v) : v;
  }
  return out;
}

const settingsPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  domain: z.string().trim().toLowerCase().max(200).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

settingsAdminRoutes.patch('/', validate({ body: settingsPatch }), async (req, res) => {
  const body = res.locals.input.body as z.infer<typeof settingsPatch>;
  const current = await prisma.store.findUniqueOrThrow({ where: { id: req.store.id } });
  let settings: Prisma.InputJsonValue | undefined;
  if (body.settings) {
    const merged = deepMerge(isObj(current.settings) ? current.settings : {}, body.settings);
    const checked = storeSettingsSchema.safeParse(merged);
    if (!checked.success) throw AppError.badRequest('Some settings are not valid', z.flattenError(checked.error));
    settings = merged as Prisma.InputJsonValue;
  }
  if (body.domain) {
    const clash = await prisma.store.findFirst({ where: { domain: body.domain, id: { not: req.store.id } } });
    if (clash) throw AppError.conflict('Another shop already uses this domain');
  }
  const s = await prisma.store.update({ where: { id: req.store.id }, data: { name: body.name, domain: body.domain, settings } });
  clearStoreCache(); // the storefront sees the change straight away
  res.json({ data: { name: s.name, domain: s.domain, settings: storeSettingsSchema.parse(s.settings) } });
});

// ─── Staff accounts (owner) ────────────────────────────────────────────

export const staffAdminRoutes = Router();
staffAdminRoutes.use(requireRole('OWNER'));

const staffSelect = { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true };

staffAdminRoutes.get('/', async (req, res) => {
  res.json({ data: await prisma.staffUser.findMany({ where: { storeId: req.store.id }, orderBy: { createdAt: 'asc' }, select: staffSelect }) });
});

const staffCreate = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
  password: passwordRule,
});

staffAdminRoutes.post('/', validate({ body: staffCreate }), async (req, res) => {
  const { password, ...body } = res.locals.input.body as z.infer<typeof staffCreate>;
  if (await prisma.staffUser.findUnique({ where: { storeId_email: { storeId: req.store.id, email: body.email } } })) {
    throw AppError.conflict('Someone already uses this email');
  }
  const s = await prisma.staffUser.create({
    data: { ...body, storeId: req.store.id, passwordHash: await hashPassword(password) },
    select: staffSelect,
  });
  res.status(201).json({ data: s });
});

const staffPatch = z
  .object({
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(20).nullable(),
    role: z.enum(['OWNER', 'ADMIN', 'STAFF']),
    isActive: z.boolean(),
    password: passwordRule,
  })
  .partial();

staffAdminRoutes.patch('/:id', validate({ params: idParam, body: staffPatch }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const { password, ...body } = res.locals.input.body as z.infer<typeof staffPatch>;
  const target = await prisma.staffUser.findFirst({ where: { id, storeId: req.store.id } });
  if (!target) throw AppError.notFound('Staff member not found');

  // The shop must always keep at least one active owner.
  const losingOwner = target.role === 'OWNER' && target.isActive && ((body.role && body.role !== 'OWNER') || body.isActive === false);
  if (losingOwner) {
    const owners = await prisma.staffUser.count({ where: { storeId: req.store.id, role: 'OWNER', isActive: true } });
    if (owners <= 1) throw AppError.badRequest('The shop needs at least one active owner');
  }

  const s = await prisma.$transaction(async (tx) => {
    const updated = await tx.staffUser.update({
      where: { id },
      data: { ...body, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
      select: staffSelect,
    });
    // Deactivated or password reset: sign them out everywhere.
    if (body.isActive === false || password) await tx.staffSession.deleteMany({ where: { staffId: id } });
    return updated;
  });
  res.json({ data: s });
});
