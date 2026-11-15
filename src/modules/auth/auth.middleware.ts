import type { RequestHandler } from 'express';
import type { StaffRole } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { resolveSession } from './auth.service.js';

export const SESSION_COOKIE = 'sid';

/** Reads the session from the httpOnly cookie, or "Authorization: Bearer <token>" for scripts/apps. */
export function readToken(req: Parameters<RequestHandler>[0]) {
  const auth = req.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
}

/** Only signed-in staff of THIS shop get through. */
export const requireStaff: RequestHandler = async (req, res, next) => {
  const token = readToken(req);
  const staff = token ? await resolveSession(token) : null;
  if (!staff || staff.storeId !== req.store.id) throw AppError.unauthorized();
  req.staff = staff;
  res.set('Cache-Control', 'no-store');
  next();
};

const RANK: Record<StaffRole, number> = { STAFF: 1, ADMIN: 2, OWNER: 3 };

/**
 * STAFF: orders and customers. ADMIN: + products, categories, suppliers.
 * OWNER: + settings, staff accounts, supplier payouts.
 */
export const requireRole =
  (min: StaffRole): RequestHandler =>
  (req, _res, next) => {
    if (!req.staff || RANK[req.staff.role] < RANK[min]) throw AppError.forbidden('Your role cannot do this');
    next();
  };
