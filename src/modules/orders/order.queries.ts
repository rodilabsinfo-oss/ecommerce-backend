import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Order status for the buyer. The phone number must match the order's,
 * so order numbers alone can't be used to look up other people's orders.
 */
export async function trackOrder(storeId: string, orderNumber: number, phone: string) {
  const o = await prisma.order.findUnique({
    where: { storeId_orderNumber: { storeId, orderNumber } },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      createdAt: true,
      subtotal: true,
      shippingFee: true,
      discount: true,
      total: true,
      shipName: true,
      shipPhone: true,
      shipProvince: true,
      shipDistrict: true,
      shipCity: true,
      shipArea: true,
      shipLandmark: true,
      customerNote: true,
      items: {
        select: { productName: true, variantTitle: true, imageUrl: true, unitPrice: true, quantity: true, lineTotal: true },
      },
      events: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true } },
    },
  });

  // Same answer for "no such order" and "wrong phone" — reveals nothing.
  if (!o || o.shipPhone !== phone) throw AppError.notFound('Order not found');

  const { shipName, shipPhone, shipProvince, shipDistrict, shipCity, shipArea, shipLandmark, events, ...rest } = o;
  return {
    ...rest,
    shipping: {
      name: shipName,
      phone: shipPhone,
      province: shipProvince,
      district: shipDistrict,
      city: shipCity,
      area: shipArea,
      landmark: shipLandmark,
    },
    timeline: events.map((e) => ({ status: e.toStatus, at: e.createdAt })),
  };
}
