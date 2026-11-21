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
      /** Logo for dark mode (e.g. white lettering). Falls back to logoUrl. */
      logoDarkUrl: z.string().optional(),
      /** Square brand mark for the browser tab and home-screen icon. */
      iconUrl: z.string().optional(),
      /**
       * Ready-made look: atelier (black + gold, elegant), bloom (rose, boutique),
       * studio (bold, streetwear), carbon (refined monochrome, premium electronics).
       */
      preset: z.enum(['atelier', 'bloom', 'studio', 'carbon']).default('atelier'),
      /** What buyers see first; they can still switch. */
      colorMode: z.enum(['system', 'light', 'dark']).default('system'),
      /** Optional brand colours that replace the preset's (light mode only). */
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      /** Brand accent for dark mode, usually a lighter tint of accentColor. */
      accentColorDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      /** Small line above the home page title, e.g. "Premium Apple store". */
      heroEyebrow: z.string().optional(),
      /** Big text on the home page banner. */
      heroTitle: z.string().optional(),
      heroSubtitle: z.string().optional(),
    })
    .prefault({}),
  /** Shop text in other languages, e.g. { ne: { heroTitle: '…', heroSubtitle: '…' } }. */
  translations: z
    .record(
      z.string(),
      z.object({
        heroEyebrow: z.string().optional(),
        heroTitle: z.string().optional(),
        heroSubtitle: z.string().optional(),
        address: z.string().optional(),
        hours: z.string().optional(),
      }),
    )
    .default({}),
  /**
   * What the shop sells. Changes wording and small pieces of the storefront:
   * fashion → sizes, size guide, size exchange; electronics → storage, warranty, genuine products.
   */
  catalog: z
    .object({
      kind: z.enum(['fashion', 'electronics']).default('fashion'),
    })
    .prefault({}),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
      /** Shop opening hours, e.g. "Sun–Fri, 10 am – 7 pm". */
      hours: z.string().optional(),
      /** Google Maps link to the shop. */
      mapUrl: z.string().url().optional(),
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
