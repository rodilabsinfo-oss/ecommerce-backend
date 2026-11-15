import type { RequestHandler } from 'express';

/**
 * Lets browsers and a CDN cache public catalogue responses briefly.
 * Varies on X-Store so two shops never share a cached answer.
 */
export const publicCache =
  (browserSeconds = 60, cdnSeconds = 300): RequestHandler =>
  (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${browserSeconds}, s-maxage=${cdnSeconds}, stale-while-revalidate=600`);
    res.vary('X-Store');
    next();
  };
