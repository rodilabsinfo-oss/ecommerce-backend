import type { RequestHandler } from 'express';
import type { Store } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const CACHE_MS = 60_000;
const cache = new Map<string, { store: Store; at: number }>();

async function findStore(key: string): Promise<Store | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.store;

  const store = await prisma.store.findFirst({
    where: { isActive: true, OR: [{ slug: key }, { domain: key }] },
  });
  if (store) cache.set(key, { store, at: Date.now() });
  return store;
}

/**
 * Works out which shop a request is for, in this order:
 *  1. the X-Store header (slug) — used by the admin app and local development
 *  2. the request's host name, matched against Store.domain
 *  3. DEFAULT_STORE_SLUG
 */
export const resolveStore: RequestHandler = async (req, _res, next) => {
  const header = req.get('x-store')?.trim();
  const store =
    (header && (await findStore(header))) ||
    (await findStore(req.hostname)) ||
    (await findStore(env.DEFAULT_STORE_SLUG));

  if (!store) throw AppError.notFound('Store not found');
  req.store = store;
  next();
};

export const clearStoreCache = () => cache.clear();
