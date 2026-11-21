/**
 * Read-only catalogue queries for the storefront.
 * Every select is written out by hand so wholesalePrice and supplier
 * details can never leak to buyers.
 */
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { type Lang, t } from '../../lib/i18n.js';
import { prisma } from '../../lib/prisma.js';
import type { ListProductsQuery } from './catalog.schemas.js';

// ─── Categories ─────────────────────────────────────────────────────────

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryNode[];
}

async function loadCategories(storeId: string) {
  return prisma.category.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, parentId: true, name: true, slug: true, imageUrl: true, translations: true },
  });
}

export async function getCategoryTree(storeId: string, lang: Lang = 'en'): Promise<CategoryNode[]> {
  const rows = await loadCategories(storeId);
  const nodes = new Map<string, CategoryNode>(
    rows.map((r) => [
      r.id,
      { id: r.id, name: t(r.translations, lang, 'name', r.name), slug: r.slug, imageUrl: r.imageUrl, children: [] },
    ]),
  );
  const roots: CategoryNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

/** The category and everything under it, so "Women" also shows "Women > Kurtas". */
async function categoryWithDescendants(storeId: string, slug: string): Promise<string[] | null> {
  const rows = await loadCategories(storeId);
  const start = rows.find((r) => r.slug === slug);
  if (!start) return null;
  const ids = [start.id];
  for (let i = 0; i < ids.length; i++) {
    for (const r of rows) if (r.parentId === ids[i]) ids.push(r.id);
  }
  return ids;
}

// ─── Product list ───────────────────────────────────────────────────────

/** Options that filter as "size": clothing sizes, phone storage, watch case sizes. */
const OPTION_NAMES = { size: ['Size', 'Storage', 'Capacity'], colour: ['Colour', 'Color', 'Finish'] };

const hasOptionValue = (names: string[], values: string[]): Prisma.ProductVariantWhereInput => ({
  optionValues: {
    some: {
      optionValue: {
        value: { in: values, mode: 'insensitive' },
        option: { name: { in: names, mode: 'insensitive' } },
      },
    },
  },
});

const ORDER_BY: Record<ListProductsQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ minPrice: 'asc' }, { id: 'desc' }],
  price_desc: [{ maxPrice: 'desc' }, { id: 'desc' }],
  name: [{ name: 'asc' }, { id: 'desc' }],
};

const listSelect = {
  id: true,
  name: true,
  slug: true,
  translations: true,
  minPrice: true,
  maxPrice: true,
  totalStock: true,
  isFeatured: true,
  images: {
    orderBy: { position: 'asc' },
    take: 2, // main photo + the one shown on hover
    select: { url: true, alt: true, width: true, height: true },
  },
  variants: {
    where: { isActive: true },
    select: { price: true, compareAtPrice: true },
  },
  options: {
    orderBy: { position: 'asc' },
    select: { name: true, values: { orderBy: { position: 'asc' }, select: { value: true, swatch: true } } },
  },
} satisfies Prisma.ProductSelect;

type ListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>;

function toListItem(p: ListRow, lang: Lang) {
  // Show the biggest "was" price among variants at the lowest price.
  const cheapest = p.variants.filter((v) => v.price === p.minPrice);
  const compareAt = Math.max(0, ...cheapest.map((v) => v.compareAtPrice ?? 0));
  return {
    id: p.id,
    name: t(p.translations, lang, 'name', p.name),
    slug: p.slug,
    price: { min: p.minPrice, max: p.maxPrice, compareAt: compareAt > p.minPrice ? compareAt : null },
    inStock: p.totalStock > 0,
    isFeatured: p.isFeatured,
    images: p.images.map((i) => ({ ...i, alt: i.alt === p.name ? t(p.translations, lang, 'name', p.name) : i.alt })),
    options: p.options,
  };
}

/** Active products in a category and/or matching a search. Shared by list and facets. */
async function baseWhere(storeId: string, q: { category?: string; q?: string }) {
  const where: Prisma.ProductWhereInput = { storeId, status: 'ACTIVE' };
  if (q.category) {
    const ids = await categoryWithDescendants(storeId, q.category);
    if (!ids) throw AppError.notFound('Category not found');
    where.categoryId = { in: ids };
  }
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { tags: { has: q.q.toLowerCase() } },
      // Nepali names, e.g. "कुर्ता"
      { translations: { path: ['ne', 'name'], string_contains: q.q } },
    ];
  }
  return where;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'FREE SIZE'];
const sizeRank = (v: string) => {
  const i = SIZE_ORDER.indexOf(v.toUpperCase());
  if (i >= 0) return i;
  // Storage: 128GB < 256GB < 1TB < 2TB
  const mem = /^(\d+(?:\.\d+)?)\s*(GB|TB)$/i.exec(v.trim());
  if (mem) return 100_000 + Number(mem[1]) * (mem[2]!.toUpperCase() === 'TB' ? 1024 : 1);
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? 1_000_000 : 100 + n; // named sizes, then numbers (28, 30, 42mm…), then the rest
};

/** The filter choices to show for a category: sizes, colours and price range. */
export async function getProductFacets(storeId: string, q: { category?: string; q?: string }) {
  const where = await baseWhere(storeId, q);
  const names = [...OPTION_NAMES.size, ...OPTION_NAMES.colour];

  const [price, values] = await Promise.all([
    prisma.product.aggregate({ where, _min: { minPrice: true }, _max: { maxPrice: true } }),
    prisma.productOptionValue.findMany({
      where: { option: { name: { in: names, mode: 'insensitive' }, product: where } },
      select: { value: true, swatch: true, option: { select: { name: true } } },
    }),
  ]);

  const isSize = (n: string) => OPTION_NAMES.size.some((s) => s.toLowerCase() === n.toLowerCase());
  const sizes = new Set<string>();
  const colours = new Map<string, string | null>();
  for (const v of values) {
    if (isSize(v.option.name)) sizes.add(v.value);
    else if (!colours.has(v.value) || !colours.get(v.value)) colours.set(v.value, v.swatch);
  }

  return {
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)),
    colours: [...colours]
      .map(([value, swatch]) => ({ value, swatch }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    price: { min: price._min.minPrice ?? 0, max: price._max.maxPrice ?? 0 },
  };
}

export async function listProducts(storeId: string, q: ListProductsQuery, lang: Lang = 'en') {
  const where = await baseWhere(storeId, q);
  // Products whose price range overlaps the requested range.
  if (q.minPrice !== undefined) where.maxPrice = { gte: q.minPrice };
  if (q.maxPrice !== undefined) where.minPrice = { lte: q.maxPrice };
  if (q.inStock) where.totalStock = { gt: 0 };
  if (q.featured !== undefined) where.isFeatured = q.featured;

  // Size and colour must match the SAME variant (a red M, not a red S + a blue M).
  const variantFilters: Prisma.ProductVariantWhereInput[] = [];
  if (q.size?.length) variantFilters.push(hasOptionValue(OPTION_NAMES.size, q.size));
  if (q.colour?.length) variantFilters.push(hasOptionValue(OPTION_NAMES.colour, q.colour));
  if (variantFilters.length) {
    where.variants = {
      some: { isActive: true, ...(q.inStock ? { stock: { gt: 0 } } : {}), AND: variantFilters },
    };
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: listSelect,
    }),
  ]);

  return {
    data: rows.map((r) => toListItem(r, lang)),
    meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  };
}

// ─── Product page ───────────────────────────────────────────────────────

export async function getProductBySlug(storeId: string, slug: string, lang: Lang = 'en') {
  const p = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug } },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      tags: true,
      translations: true,
      seoTitle: true,
      seoDescription: true,
      minPrice: true,
      maxPrice: true,
      totalStock: true,
      category: { select: { id: true, name: true, slug: true, translations: true } },
      options: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          values: { orderBy: { position: 'asc' }, select: { id: true, value: true, swatch: true } },
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          stock: true,
          optionValues: { select: { optionValueId: true } },
        },
      },
      images: {
        orderBy: { position: 'asc' },
        select: { id: true, url: true, alt: true, width: true, height: true, optionValueId: true },
      },
    },
  });

  if (!p || p.status !== 'ACTIVE') throw AppError.notFound('Product not found');

  const { status: _status, totalStock, variants, translations, category, ...rest } = p;
  const name = t(translations, lang, 'name', p.name);
  return {
    ...rest,
    name,
    description: t(translations, lang, 'description', p.description),
    seoTitle: t(translations, lang, 'seoTitle', p.seoTitle),
    seoDescription: t(translations, lang, 'seoDescription', p.seoDescription),
    category: category && { id: category.id, slug: category.slug, name: t(category.translations, lang, 'name', category.name) },
    images: p.images.map((i) => ({ ...i, alt: i.alt === p.name ? name : i.alt })),
    inStock: totalStock > 0,
    variants: variants.map(({ optionValues, ...v }) => ({
      ...v,
      optionValueIds: optionValues.map((o) => o.optionValueId),
    })),
  };
}
