/**
 * Cart pricing. The cart itself lives in the browser; the server always
 * re-checks prices and stock so buyers never pay an old price.
 */
import type { Prisma, Store } from '../../generated/prisma/client.js';
import { type Lang, t } from '../../lib/i18n.js';
import { prisma } from '../../lib/prisma.js';
import { getStoreSettings } from '../stores/store-settings.js';

type Db = Prisma.TransactionClient | typeof prisma;

const variantSelect = {
  id: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  wholesalePrice: true,
  stock: true,
  isActive: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      supplierId: true,
      translations: true,
      images: { orderBy: { position: 'asc' }, select: { url: true, optionValueId: true } },
    },
  },
  optionValues: {
    select: { optionValue: { select: { id: true, value: true, option: { select: { position: true } } } } },
  },
} satisfies Prisma.ProductVariantSelect;

export type LoadedVariant = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

export async function loadVariants(db: Db, storeId: string, ids: string[]) {
  const rows = await db.productVariant.findMany({ where: { storeId, id: { in: ids } }, select: variantSelect });
  return new Map(rows.map((r) => [r.id, r]));
}

/** "M / Maroon", in option order. */
export const variantTitle = (v: LoadedVariant) =>
  [...v.optionValues]
    .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
    .map((o) => o.optionValue.value)
    .join(' / ');

/** The photo for this variant's colour, else the product's first photo. */
export function variantImage(v: LoadedVariant) {
  const ids = new Set(v.optionValues.map((o) => o.optionValue.id));
  return (v.product.images.find((i) => i.optionValueId && ids.has(i.optionValueId)) ?? v.product.images[0])?.url ?? null;
}

export const isBuyable = (v: LoadedVariant | undefined) => !!v && v.isActive && v.product.status === 'ACTIVE';

export function shippingFee(store: Store, subtotal: number) {
  const { shipping } = getStoreSettings(store);
  if (subtotal <= 0) return 0;
  if (shipping.freeAbove !== undefined && subtotal >= shipping.freeAbove) return 0;
  return shipping.flatFee;
}

export type LineProblem = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'REDUCED' | null;

/**
 * Prices a cart. Lines that can't be bought are flagged (not dropped), so the
 * storefront can tell the buyer exactly what changed.
 */
export async function quoteCart(store: Store, items: { variantId: string; quantity: number }[], lang: Lang) {
  const variants = await loadVariants(prisma, store.id, items.map((i) => i.variantId));

  const lines = items.map(({ variantId, quantity }) => {
    const v = variants.get(variantId);
    if (!isBuyable(v)) {
      return { variantId, quantity, available: 0, problem: 'UNAVAILABLE' as LineProblem, lineTotal: 0 };
    }
    const problem: LineProblem = v!.stock <= 0 ? 'OUT_OF_STOCK' : v!.stock < quantity ? 'REDUCED' : null;
    const billable = Math.min(quantity, Math.max(0, v!.stock));
    return {
      variantId,
      productSlug: v!.product.slug,
      name: t(v!.product.translations, lang, 'name', v!.product.name),
      variantTitle: variantTitle(v!),
      sku: v!.sku,
      image: variantImage(v!),
      unitPrice: v!.price,
      compareAtPrice: v!.compareAtPrice,
      quantity,
      available: Math.max(0, v!.stock),
      problem,
      lineTotal: v!.price * billable,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const fee = shippingFee(store, subtotal);
  const { shipping } = getStoreSettings(store);

  return {
    lines,
    subtotal,
    shippingFee: fee,
    discount: 0,
    total: subtotal + fee,
    /** How much more to spend for free delivery (0 if already free / not offered). */
    freeDeliveryGap:
      shipping.freeAbove !== undefined && subtotal > 0 && subtotal < shipping.freeAbove ? shipping.freeAbove - subtotal : 0,
    canCheckout: lines.length > 0 && lines.every((l) => l.problem === null),
  };
}
