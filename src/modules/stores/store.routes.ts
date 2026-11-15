import { Router } from 'express';
import { getStoreSettings } from './store-settings.js';

export const storeRoutes = Router();

/** Public shop info the storefront needs on first load. */
storeRoutes.get('/current', (req, res) => {
  const { id, slug, name, currency } = req.store;
  const { theme, contact, social, tracking, shipping, translations } = getStoreSettings(req.store);
  const local = translations[req.lang] ?? {};
  res.json({
    data: {
      id,
      slug,
      name,
      currency,
      theme: { ...theme, heroTitle: local.heroTitle ?? theme.heroTitle, heroSubtitle: local.heroSubtitle ?? theme.heroSubtitle },
      contact,
      social,
      tracking,
      shipping,
    },
  });
});
