import type { RequestHandler } from 'express';

/** Languages the shop can show. English lives in the main columns; others in `translations` JSON. */
export const LANGS = ['en', 'ne'] as const;
export type Lang = (typeof LANGS)[number];

/** Reads ?lang=ne (falls back to English). Kept in the query string so CDN caches split by language. */
export const resolveLang: RequestHandler = (req, _res, next) => {
  const q = req.query.lang;
  req.lang = typeof q === 'string' && (LANGS as readonly string[]).includes(q) ? (q as Lang) : 'en';
  next();
};

type Translations = Record<string, Record<string, string | null | undefined>>;

/**
 * Returns `value` in the wanted language when a translation exists, else the English value.
 *   t(product.translations, 'ne', 'name', product.name)
 */
export function t(translations: unknown, lang: Lang, field: string, fallback: string): string;
export function t(translations: unknown, lang: Lang, field: string, fallback: string | null): string | null;
export function t(translations: unknown, lang: Lang, field: string, fallback: string | null) {
  if (lang === 'en' || !translations || typeof translations !== 'object') return fallback;
  const v = (translations as Translations)[lang]?.[field];
  return typeof v === 'string' && v.trim() ? v : fallback;
}
