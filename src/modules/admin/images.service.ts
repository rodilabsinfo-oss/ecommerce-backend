import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';

const MAX_SIDE = 2000;

/**
 * Turns any uploaded photo into a WebP of at most 2000px, with phone rotation
 * fixed and camera data (location etc.) removed. Smaller files, faster shop.
 */
export async function processPhoto(input: Buffer) {
  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw AppError.badRequest('That file is not a photo we can read (use JPG, PNG or WebP)');
  }
}

async function ownProduct(storeId: string, productId: string) {
  const p = await prisma.product.findFirst({ where: { id: productId, storeId }, select: { id: true, name: true } });
  if (!p) throw AppError.notFound('Product not found');
  return p;
}

async function ownOptionValue(productId: string, optionValueId?: string | null) {
  if (!optionValueId) return null;
  const v = await prisma.productOptionValue.findFirst({ where: { id: optionValueId, option: { productId } } });
  if (!v) throw AppError.badRequest('That colour/option does not belong to this product');
  return v.id;
}

export async function addProductPhotos(
  storeId: string,
  productId: string,
  files: { buffer: Buffer }[],
  optionValueId?: string | null,
) {
  const product = await ownProduct(storeId, productId);
  const valueId = await ownOptionValue(productId, optionValueId);
  if (!files.length) throw AppError.badRequest('Choose at least one photo');

  const last = await prisma.productImage.aggregate({ where: { productId }, _max: { position: true } });
  let position = (last._max.position ?? -1) + 1;

  const created = [];
  for (const f of files) {
    const photo = await processPhoto(f.buffer);
    const url = await storage.put(`${storeId}/products/${productId}/${randomUUID()}.webp`, photo.data, 'image/webp');
    created.push(
      await prisma.productImage.create({
        data: { productId, url, alt: product.name, width: photo.width, height: photo.height, position: position++, optionValueId: valueId },
      }),
    );
  }
  return created;
}

export async function updatePhoto(storeId: string, imageId: string, patch: { alt?: string; optionValueId?: string | null }) {
  const img = await prisma.productImage.findFirst({ where: { id: imageId, product: { storeId } } });
  if (!img) throw AppError.notFound('Photo not found');
  const optionValueId = patch.optionValueId === undefined ? undefined : await ownOptionValue(img.productId, patch.optionValueId);
  return prisma.productImage.update({ where: { id: imageId }, data: { alt: patch.alt, optionValueId } });
}

export async function deletePhoto(storeId: string, imageId: string) {
  const img = await prisma.productImage.findFirst({ where: { id: imageId, product: { storeId } } });
  if (!img) throw AppError.notFound('Photo not found');
  await prisma.productImage.delete({ where: { id: imageId } });
  await storage.removeByUrl(img.url);
}

/** Saves a new photo order: ids in the order they should appear. */
export async function reorderPhotos(storeId: string, productId: string, ids: string[]) {
  await ownProduct(storeId, productId);
  const existing = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
  const known = new Set(existing.map((e) => e.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw AppError.badRequest('Send every photo id of this product exactly once');
  }
  await prisma.$transaction(ids.map((id, position) => prisma.productImage.update({ where: { id }, data: { position } })));
}
