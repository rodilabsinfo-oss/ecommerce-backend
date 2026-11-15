import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slug.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../auth/auth.middleware.js';

export const categoryAdminRoutes = Router();
categoryAdminRoutes.use(requireRole('ADMIN'));

const idParam = z.object({ id: z.string().uuid() });
const fields = {
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(80).optional(),
  parentId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  translations: z.record(z.string(), z.object({ name: z.string() }).partial()).optional(),
};
const createInput = z.object(fields);
const updateInput = z.object(fields).partial();

/** All categories (including hidden ones) with how many products each has. */
categoryAdminRoutes.get('/', async (req, res) => {
  const rows = await prisma.category.findMany({
    where: { storeId: req.store.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  res.json({ data: rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })) });
});

async function checkParent(storeId: string, id: string | null, parentId?: string | null) {
  if (!parentId) return;
  if (parentId === id) throw AppError.badRequest('A category cannot be inside itself');
  const all = await prisma.category.findMany({ where: { storeId }, select: { id: true, parentId: true } });
  const byId = new Map(all.map((c) => [c.id, c.parentId]));
  if (!byId.has(parentId)) throw AppError.badRequest('Parent category not found');
  // Walk up from the new parent; meeting ourselves would make a loop.
  for (let cur: string | null | undefined = parentId; cur; cur = byId.get(cur)) {
    if (cur === id) throw AppError.badRequest('That would put a category inside its own sub-category');
  }
}

async function uniqueSlug(storeId: string, wanted: string, exceptId?: string) {
  const slug = slugify(wanted) || 'category';
  const clash = await prisma.category.findFirst({ where: { storeId, slug, id: exceptId ? { not: exceptId } : undefined } });
  if (clash) throw AppError.conflict('Another category already uses this link name');
  return slug;
}

categoryAdminRoutes.post('/', validate({ body: createInput }), async (req, res) => {
  const body = res.locals.input.body as z.infer<typeof createInput>;
  await checkParent(req.store.id, null, body.parentId);
  const slug = await uniqueSlug(req.store.id, body.slug || body.name);
  const c = await prisma.category.create({ data: { ...body, slug, storeId: req.store.id } });
  res.status(201).json({ data: c });
});

categoryAdminRoutes.patch('/:id', validate({ params: idParam, body: updateInput }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const body = res.locals.input.body as z.infer<typeof updateInput>;
  if (!(await prisma.category.findFirst({ where: { id, storeId: req.store.id } }))) throw AppError.notFound('Category not found');
  await checkParent(req.store.id, id, body.parentId);
  if (body.slug !== undefined) body.slug = await uniqueSlug(req.store.id, body.slug, id);
  res.json({ data: await prisma.category.update({ where: { id }, data: body }) });
});

/** Products in it become uncategorised; sub-categories move to the top level. */
categoryAdminRoutes.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const r = await prisma.category.deleteMany({ where: { id, storeId: req.store.id } });
  if (!r.count) throw AppError.notFound('Category not found');
  res.status(204).end();
});
