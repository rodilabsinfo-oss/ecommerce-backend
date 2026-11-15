import { z } from 'zod';

/** Nepal's seven provinces, as buyers know them. */
export const PROVINCES = ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim'] as const;

/**
 * Nepali mobile number. Accepts "98XXXXXXXX", "+977 98XXXXXXXX", "977-98…" with spaces or dashes,
 * and stores it as the plain 10 digits.
 */
export const nepalPhone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+?977)/, ''))
  .pipe(z.string().regex(/^9\d{9}$/, 'Enter a 10-digit mobile number starting with 9'));

const cartItem = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const cartItems = z
  .array(cartItem)
  .min(1, 'Your cart is empty')
  .max(50)
  // Same variant twice → one line with the quantities added up.
  .transform((items) => {
    const merged = new Map<string, number>();
    for (const i of items) merged.set(i.variantId, Math.min(20, (merged.get(i.variantId) ?? 0) + i.quantity));
    return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
  });

export const quoteInput = z.object({ items: cartItems });
export type QuoteInput = z.infer<typeof quoteInput>;

export const checkoutInput = z.object({
  items: cartItems,
  customer: z.object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    phone: nepalPhone,
    email: z.string().trim().email().max(120).optional().or(z.literal('').transform(() => undefined)),
  }),
  address: z.object({
    province: z.enum(PROVINCES),
    district: z.string().trim().min(2).max(60),
    city: z.string().trim().min(2).max(60),
    area: z.string().trim().min(2).max(120),
    landmark: z.string().trim().max(120).optional(),
  }),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['COD', 'ESEWA', 'KHALTI', 'FONEPAY']).default('COD'),
  /** utm_source etc. from the ad the buyer came from. */
  source: z.record(z.string(), z.string().max(200)).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const trackParams = z.object({ orderNumber: z.coerce.number().int().positive() });
export const trackQuery = z.object({ phone: nepalPhone });
