import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { slugify } from '../../lib/slug.js';
import { type CreateProductInput, createProductInput } from './catalog.schemas.js';

type Tx = Prisma.TransactionClient;

/** Recalculates the product's price range and stock from its active variants. */
export async function refreshProductSummary(tx: Tx, productId: string) {
  const agg = await tx.productVariant.aggregate({
    where: { productId, isActive: true },
    _min: { price: true },
    _max: { price: true },
    _sum: { stock: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      minPrice: agg._min.price ?? 0,
      maxPrice: agg._max.price ?? 0,
      totalStock: agg._sum.stock ?? 0,
    },
  });
}

/** Picks a slug that is free in this shop: "kurta", then "kurta-2", ... */
async function uniqueSlug(tx: Tx, storeId: string, base: string) {
  const root = slugify(base) || 'product';
  const taken = await tx.product.findMany({
    where: { storeId, slug: { startsWith: root } },
    select: { slug: true },
  });
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(root)) return root;
  for (let i = 2; ; i++) if (!used.has(`${root}-${i}`)) return `${root}-${i}`;
}

/**
 * Creates a product with its options, variants and photos in one transaction.
 *
 *   options:  [{ name: "Size", values: [{ value: "M" }] }, { name: "Colour", ... }]
 *   variants: [{ options: { Size: "M", Colour: "Red" }, price: 250000, stock: 5 }]
 */
export async function createProduct(storeId: string, rawInput: CreateProductInput) {
  const input = createProductInput.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(tx, storeId, input.slug || input.name);

    const product = await tx.product.create({
      data: {
        storeId,
        slug,
        name: input.name,
        description: input.description,
        status: input.status,
        isFeatured: input.isFeatured,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        tags: input.tags,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        options: {
          create: input.options.map((o, i) => ({
            name: o.name,
            position: i,
            values: { create: o.values.map((v, j) => ({ value: v.value, swatch: v.swatch, position: j })) },
          })),
        },
      },
      include: { options: { include: { values: true } } },
    });

    // "Size" -> "M" -> optionValueId
    const valueId = new Map<string, Map<string, string>>();
    for (const o of product.options) valueId.set(o.name, new Map(o.values.map((v) => [v.value, v.id])));

    const lookup = (name: string, value: string) => {
      const id = valueId.get(name)?.get(value);
      if (!id) throw AppError.badRequest(`Unknown option ${name}: ${value}`);
      return id;
    };

    for (const [i, v] of input.variants.entries()) {
      const names = Object.keys(v.options);
      if (names.length !== product.options.length || product.options.some((o) => !(o.name in v.options))) {
        throw AppError.badRequest(`Variant ${i + 1} must have exactly one value for each option`);
      }
      const optionValueIds = product.options.map((o) => lookup(o.name, v.options[o.name]!));
      const sku =
        v.sku ?? [slug, ...product.options.map((o) => v.options[o.name])].join('-').toUpperCase().slice(0, 64);

      await tx.productVariant.create({
        data: {
          storeId,
          productId: product.id,
          sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          wholesalePrice: v.wholesalePrice,
          stock: v.stock,
          isActive: v.isActive,
          position: i,
          optionValues: { create: optionValueIds.map((optionValueId) => ({ optionValueId })) },
        },
      });
    }

    if (input.images.length) {
      await tx.productImage.createMany({
        data: input.images.map((img, i) => ({
          productId: product.id,
          url: img.url,
          alt: img.alt ?? input.name,
          width: img.width,
          height: img.height,
          position: i,
          optionValueId: img.option ? lookup(img.option.name, img.option.value) : null,
        })),
      });
    }

    await refreshProductSummary(tx, product.id);
    return product;
  });
}
