/**
 * Product management for staff. Unlike the storefront queries, these show
 * wholesale prices, suppliers, drafts and archived products.
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slug.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../auth/auth.middleware.js';
import { createProductInput } from '../catalog/catalog.schemas.js';
import { createProduct, refreshProductSummary } from '../catalog/product.service.js';
import { addProductPhotos, deletePhoto, reorderPhotos, updatePhoto } from './images.service.js';

export const productAdminRoutes = Router();
productAdminRoutes.use(requireRole('ADMIN'));

const idParam = z.object({ id: z.string().uuid() });
const translations = z.record(z.string(), z.object({ name: z.string(), description: z.string() }).partial());

async function checkRefs(storeId: string, refs: { categoryId?: string | null; supplierId?: string | null }) {
  if (refs.categoryId && !(await prisma.category.findFirst({ where: { id: refs.categoryId, storeId } }))) {
    throw AppError.badRequest('Category not found');
  }
  if (refs.supplierId && !(await prisma.supplier.findFirst({ where: { id: refs.supplierId, storeId } }))) {
    throw AppError.badRequest('Supplier not found');
  }
}

async function ownProduct(storeId: string, id: string) {
  const p = await prisma.product.findFirst({ where: { id, storeId }, select: { id: true } });
  if (!p) throw AppError.notFound('Product not found');
  return p;
}

// ─── List ──────────────────────────────────────────────────────────────

const listQuery = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  lowStock: z.enum(['true']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

productAdminRoutes.get('/', validate({ query: listQuery }), async (req, res) => {
  const q = res.locals.input.query as z.infer<typeof listQuery>;
  const where: Prisma.ProductWhereInput = {
    storeId: req.store.id,
    status: q.status,
    categoryId: q.categoryId,
    supplierId: q.supplierId,
    ...(q.lowStock ? { variants: { some: { isActive: true, stock: { lte: 3 } } } } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { variants: { some: { sku: { contains: q.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isFeatured: true,
        minPrice: true,
        maxPrice: true,
        totalStock: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        _count: { select: { variants: true } },
      },
    }),
  ]);
  res.json({
    data: rows.map(({ images, _count, ...p }) => ({ ...p, image: images[0]?.url ?? null, variantCount: _count.variants })),
    meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

// ─── Detail ────────────────────────────────────────────────────────────

productAdminRoutes.get('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const p = await prisma.product.findFirst({
    where: { id, storeId: req.store.id },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      options: { orderBy: { position: 'asc' }, include: { values: { orderBy: { position: 'asc' } } } },
      variants: { orderBy: { position: 'asc' }, include: { optionValues: { select: { optionValueId: true } } } },
      images: { orderBy: { position: 'asc' } },
    },
  });
  if (!p) throw AppError.notFound('Product not found');
  res.json({
    data: {
      ...p,
      variants: p.variants.map(({ optionValues, ...v }) => ({ ...v, optionValueIds: optionValues.map((o) => o.optionValueId) })),
    },
  });
});

// ─── Create / update / remove ──────────────────────────────────────────

productAdminRoutes.post('/', validate({ body: createProductInput }), async (req, res) => {
  const body = res.locals.input.body as z.infer<typeof createProductInput>;
  await checkRefs(req.store.id, body);
  const product = await createProduct(req.store.id, body);
  res.status(201).json({ data: { id: product.id, slug: product.slug } });
});

const updateInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().trim().min(1).max(120),
    description: z.string().nullable(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    isFeatured: z.boolean(),
    categoryId: z.string().uuid().nullable(),
    supplierId: z.string().uuid().nullable(),
    tags: z.array(z.string()),
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    translations,
  })
  .partial();

productAdminRoutes.patch('/:id', validate({ params: idParam, body: updateInput }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const body = res.locals.input.body as z.infer<typeof updateInput>;
  await ownProduct(req.store.id, id);
  await checkRefs(req.store.id, body);
  if (body.slug) {
    body.slug = slugify(body.slug);
    const clash = await prisma.product.findFirst({ where: { storeId: req.store.id, slug: body.slug, id: { not: id } } });
    if (clash) throw AppError.conflict('Another product already uses this link name');
  }
  const p = await prisma.product.update({ where: { id }, data: body, select: { id: true, slug: true, status: true } });
  res.json({ data: p });
});

/** Products that were ever ordered are archived (kept for order history); others are deleted. */
productAdminRoutes.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  await ownProduct(req.store.id, id);
  const ordered = await prisma.orderItem.count({ where: { variant: { productId: id } } });
  if (ordered) {
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    res.json({ data: { archived: true } });
  } else {
    const images = await prisma.productImage.findMany({ where: { productId: id }, select: { id: true } });
    for (const img of images) await deletePhoto(req.store.id, img.id);
    await prisma.product.delete({ where: { id } });
    res.json({ data: { deleted: true } });
  }
});

// ─── Variants ──────────────────────────────────────────────────────────

const variantPatch = z
  .object({
    sku: z.string().trim().min(1).max(64),
    price: z.number().int().nonnegative(),
    compareAtPrice: z.number().int().nonnegative().nullable(),
    wholesalePrice: z.number().int().nonnegative(),
    stock: z.number().int().nonnegative(),
    isActive: z.boolean(),
  })
  .partial();

export const variantAdminRoutes = Router();
variantAdminRoutes.use(requireRole('ADMIN'));

variantAdminRoutes.patch('/:id', validate({ params: idParam, body: variantPatch }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const body = res.locals.input.body as z.infer<typeof variantPatch>;
  const v = await prisma.productVariant.findFirst({ where: { id, storeId: req.store.id } });
  if (!v) throw AppError.notFound('Variant not found');
  if (body.sku && body.sku !== v.sku) {
    const clash = await prisma.productVariant.findFirst({ where: { storeId: req.store.id, sku: body.sku } });
    if (clash) throw AppError.conflict('Another item already uses this SKU');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.productVariant.update({ where: { id }, data: body });
    await refreshProductSummary(tx, v.productId);
    return u;
  });
  res.json({ data: updated });
});

/** Add a size/colour combination, e.g. { options: { Size: "XXL", Colour: "Red" }, price, stock }. New values are created. */
const variantCreate = z.object({
  options: z.record(z.string(), z.string().trim().min(1)),
  swatches: z.record(z.string(), z.string()).optional(),
  sku: z.string().trim().min(1).max(64).optional(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  wholesalePrice: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
});

productAdminRoutes.post('/:id/variants', validate({ params: idParam, body: variantCreate }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const body = res.locals.input.body as z.infer<typeof variantCreate>;
  const product = await prisma.product.findFirst({
    where: { id, storeId: req.store.id },
    include: {
      options: { include: { values: true } },
      variants: { include: { optionValues: { select: { optionValueId: true } } } },
    },
  });
  if (!product) throw AppError.notFound('Product not found');

  const names = Object.keys(body.options);
  if (names.length !== product.options.length || product.options.some((o) => !(o.name in body.options))) {
    throw AppError.badRequest(`Give one value for each option: ${product.options.map((o) => o.name).join(', ')}`);
  }

  const variant = await prisma.$transaction(async (tx) => {
    const valueIds: string[] = [];
    for (const o of product.options) {
      const wanted = body.options[o.name]!;
      const existing = o.values.find((v) => v.value.toLowerCase() === wanted.toLowerCase());
      valueIds.push(
        existing?.id ??
          (
            await tx.productOptionValue.create({
              data: { optionId: o.id, value: wanted, swatch: body.swatches?.[o.name], position: o.values.length },
            })
          ).id,
      );
    }
    const dup = product.variants.find((v) => valueIds.every((vid) => v.optionValues.some((ov) => ov.optionValueId === vid)));
    if (dup) throw AppError.conflict('This size/colour combination already exists');

    const sku = body.sku ?? [product.slug, ...product.options.map((o) => body.options[o.name])].join('-').toUpperCase().slice(0, 64);
    if (await tx.productVariant.findFirst({ where: { storeId: req.store.id, sku } })) {
      throw AppError.conflict('Another item already uses this SKU');
    }
    const created = await tx.productVariant.create({
      data: {
        storeId: req.store.id,
        productId: id,
        sku,
        price: body.price,
        compareAtPrice: body.compareAtPrice,
        wholesalePrice: body.wholesalePrice,
        stock: body.stock,
        position: product.variants.length,
        optionValues: { create: valueIds.map((optionValueId) => ({ optionValueId })) },
      },
    });
    await refreshProductSummary(tx, id);
    return created;
  });
  res.status(201).json({ data: variant });
});

/** Rename an option value or change its colour swatch. */
const optionValuePatch = z.object({ value: z.string().trim().min(1), swatch: z.string().nullable() }).partial();
export const optionValueAdminRoutes = Router();
optionValueAdminRoutes.use(requireRole('ADMIN'));
optionValueAdminRoutes.patch('/:id', validate({ params: idParam, body: optionValuePatch }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const v = await prisma.productOptionValue.findFirst({ where: { id, option: { product: { storeId: req.store.id } } } });
  if (!v) throw AppError.notFound('Option value not found');
  res.json({ data: await prisma.productOptionValue.update({ where: { id }, data: res.locals.input.body }) });
});

// ─── Photos ────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.mimetype)),
});

/** multipart/form-data: photos[] (up to 10) + optional optionValueId (the colour they show). */
productAdminRoutes.post('/:id/images', upload.array('photos', 10), validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const optionValueId = typeof req.body?.optionValueId === 'string' && req.body.optionValueId ? req.body.optionValueId : null;
  const created = await addProductPhotos(req.store.id, id, files, optionValueId);
  res.status(201).json({ data: created });
});

productAdminRoutes.put(
  '/:id/images/order',
  validate({ params: idParam, body: z.object({ ids: z.array(z.string().uuid()) }) }),
  async (req, res) => {
    const { id } = res.locals.input.params as { id: string };
    await reorderPhotos(req.store.id, id, (res.locals.input.body as { ids: string[] }).ids);
    res.status(204).end();
  },
);

export const imageAdminRoutes = Router();
imageAdminRoutes.use(requireRole('ADMIN'));
imageAdminRoutes.patch(
  '/:id',
  validate({ params: idParam, body: z.object({ alt: z.string().max(200), optionValueId: z.string().uuid().nullable() }).partial() }),
  async (req, res) => {
    const { id } = res.locals.input.params as { id: string };
    res.json({ data: await updatePhoto(req.store.id, id, res.locals.input.body) });
  },
);
imageAdminRoutes.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const { id } = res.locals.input.params as { id: string };
  await deletePhoto(req.store.id, id);
  res.status(204).end();
});
