/**
 * Placing an order. Everything happens in one database transaction:
 * stock is taken, the order number assigned, prices copied — or nothing is.
 */
import { Prisma, type Store } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { type Lang, t } from '../../lib/i18n.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { refreshProductSummary } from '../catalog/product.service.js';
import { getProvider } from '../payments/payment.registry.js';
import type { PaymentNextStep } from '../payments/payment.types.js';
import { isBuyable, loadVariants, shippingFee, variantImage, variantTitle } from './cart.service.js';
import type { CheckoutInput } from './orders.schemas.js';

export interface PlacedOrder {
  orderNumber: number;
  status: string;
  paymentMethod: string;
  total: number;
  next: PaymentNextStep;
}

const outOfStock = (items: { variantId: string; available: number }[]) =>
  new AppError(409, 'OUT_OF_STOCK', 'Some items are no longer available in the quantity you chose', { items });

async function existingOrder(storeId: string, idempotencyKey: string): Promise<PlacedOrder | null> {
  const o = await prisma.order.findUnique({
    where: { storeId_idempotencyKey: { storeId, idempotencyKey } },
    select: { orderNumber: true, status: true, paymentMethod: true, total: true },
  });
  return o && { ...o, next: { type: 'none' } };
}

export async function placeOrder(
  store: Store,
  input: CheckoutInput,
  lang: Lang,
  idempotencyKey?: string,
): Promise<PlacedOrder> {
  // Same checkout sent twice (double tap, flaky network)? Return the first order.
  if (idempotencyKey) {
    const prior = await existingOrder(store.id, idempotencyKey);
    if (prior) return prior;
  }

  // Fails early if this shop hasn't switched the method on.
  const provider = getProvider(store, input.paymentMethod);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const variants = await loadVariants(tx, store.id, input.items.map((i) => i.variantId));

      // 1. Everything must exist, be on sale and be in stock.
      const short = input.items
        .filter((i) => {
          const v = variants.get(i.variantId);
          return !isBuyable(v) || v!.stock < i.quantity;
        })
        .map((i) => {
          const v = variants.get(i.variantId);
          return { variantId: i.variantId, available: isBuyable(v) ? Math.max(0, v!.stock) : 0 };
        });
      if (short.length) throw outOfStock(short);

      // 2. Take the stock. The "stock >= quantity" condition makes this safe when
      //    two buyers check out the last piece at the same moment.
      for (const i of input.items) {
        const r = await tx.productVariant.updateMany({
          where: { id: i.variantId, stock: { gte: i.quantity } },
          data: { stock: { decrement: i.quantity } },
        });
        if (r.count !== 1) throw outOfStock([{ variantId: i.variantId, available: 0 }]);
      }
      const productIds = new Set(input.items.map((i) => variants.get(i.variantId)!.product.id));
      for (const id of productIds) await refreshProductSummary(tx, id);

      // 3. The buyer (one record per phone number per shop).
      const customer = await tx.customer.upsert({
        where: { storeId_phone: { storeId: store.id, phone: input.customer.phone } },
        update: { name: input.customer.name, ...(input.customer.email ? { email: input.customer.email } : {}) },
        create: { storeId: store.id, name: input.customer.name, phone: input.customer.phone, email: input.customer.email },
        select: { id: true, _count: { select: { addresses: true } } },
      });
      if (customer._count.addresses === 0) {
        await tx.address.create({
          data: { customerId: customer.id, fullName: input.customer.name, phone: input.customer.phone, ...input.address, isDefault: true },
        });
      }

      // 4. Next order number for this shop.
      const { orderSeq: orderNumber } = await tx.store.update({
        where: { id: store.id },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true },
      });

      // 5. Copy names and prices as they are right now.
      const items = input.items.map(({ variantId, quantity }) => {
        const v = variants.get(variantId)!;
        return {
          variantId,
          supplierId: v.product.supplierId,
          productName: t(v.product.translations, lang, 'name', v.product.name),
          variantTitle: variantTitle(v),
          sku: v.sku,
          imageUrl: variantImage(v),
          unitPrice: v.price,
          wholesalePrice: v.wholesalePrice,
          quantity,
          lineTotal: v.price * quantity,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
      const fee = shippingFee(store, subtotal);
      const total = subtotal + fee;

      const order = await tx.order.create({
        data: {
          storeId: store.id,
          orderNumber,
          idempotencyKey,
          lang,
          customerId: customer.id,
          paymentMethod: input.paymentMethod,
          subtotal,
          shippingFee: fee,
          total,
          shipName: input.customer.name,
          shipPhone: input.customer.phone,
          shipProvince: input.address.province,
          shipDistrict: input.address.district,
          shipCity: input.address.city,
          shipArea: input.address.area,
          shipLandmark: input.address.landmark,
          customerNote: input.note,
          source: input.source,
          items: { create: items },
          events: { create: { toStatus: 'PENDING', note: 'Order placed' } },
        },
        select: { id: true, orderNumber: true, status: true, paymentMethod: true, total: true },
      });

      // 6. Payment record. COD stays PENDING until the cash is collected.
      const pay = await provider.initiate({ id: order.id, orderNumber, total });
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          status: pay.status,
          amount: total,
          providerRef: pay.providerRef,
          providerData: pay.providerData as Prisma.InputJsonValue | undefined,
        },
      });

      return { ...order, next: pay.next };
    });

    logger.info({ store: store.slug, orderNumber: created.orderNumber, total: created.total }, 'Order placed');
    const { id: _id, ...result } = created;
    return result;
  } catch (err) {
    // Two identical requests raced past the first check: hand back the winner.
    if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const prior = await existingOrder(store.id, idempotencyKey);
      if (prior) return prior;
    }
    throw err;
  }
}
