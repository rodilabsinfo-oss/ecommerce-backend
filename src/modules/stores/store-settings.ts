import { z } from 'zod';
import type { Store } from '../../generated/prisma/client.js';

/**
 * Everything that makes one client's shop different from another's.
 * Stored in Store.settings as JSON; missing keys fall back to these defaults,
 * so new settings can be added without touching old shops.
 */
export const storeSettingsSchema = z.object({
  theme: z
    .object({
      logoUrl: z.string().optional(),
      primaryColor: z.string().default('#111827'),
      accentColor: z.string().default('#e11d48'),
      fontFamily: z.string().default('Inter'),
    })
    .prefault({}),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
    })
    .prefault({}),
  social: z
    .object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
    })
    .prefault({}),
  tracking: z
    .object({
      metaPixelId: z.string().optional(),
      tiktokPixelId: z.string().optional(),
      googleAnalyticsId: z.string().optional(),
    })
    .prefault({}),
  payments: z
    .object({
      enabled: z.array(z.enum(['COD', 'ESEWA', 'KHALTI', 'FONEPAY'])).default(['COD']),
    })
    .prefault({}),
  shipping: z
    .object({
      /** Flat delivery fee in paisa. */
      flatFee: z.number().int().nonnegative().default(10000),
      /** Free delivery at or above this subtotal (paisa). Unset = never free. */
      freeAbove: z.number().int().nonnegative().optional(),
    })
    .prefault({}),
});

export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const getStoreSettings = (store: Pick<Store, 'settings'>): StoreSettings =>
  storeSettingsSchema.parse(store.settings ?? {});
