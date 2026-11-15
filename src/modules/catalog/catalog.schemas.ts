import { z } from 'zod';

const csv = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .optional();

/** Query string for GET /products. Prices are in paisa. */
export const listProductsQuery = z.object({
  category: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  size: csv,
  colour: csv,
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

export const slugParams = z.object({ slug: z.string().min(1).max(120) });

// ─── Creating products (used by the seed now, admin API later) ──────────

const optionValueInput = z.object({
  value: z.string().trim().min(1),
  swatch: z.string().optional(),
});

const variantInput = z.object({
  /** e.g. { Size: "M", Colour: "Red" } — one value for every option. */
  options: z.record(z.string(), z.string()),
  sku: z.string().trim().min(1).optional(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  wholesalePrice: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

const imageInput = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Tie the photo to one option value, e.g. { name: "Colour", value: "Red" }. */
  option: z.object({ name: z.string(), value: z.string() }).optional(),
});

export const createProductInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(120).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  isFeatured: z.boolean().default(false),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  options: z
    .array(z.object({ name: z.string().trim().min(1), values: z.array(optionValueInput).min(1) }))
    .default([]),
  variants: z.array(variantInput).min(1),
  images: z.array(imageInput).default([]),
});
export type CreateProductInput = z.input<typeof createProductInput>;

/** Query string for GET /products/facets. */
export const facetsQuery = z.object({
  category: z.string().optional(),
  q: z.string().trim().max(100).optional(),
});
export type FacetsQuery = z.infer<typeof facetsQuery>;
