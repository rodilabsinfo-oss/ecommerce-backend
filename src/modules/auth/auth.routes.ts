import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { SESSION_COOKIE, requireStaff } from './auth.middleware.js';
import { changePassword, login, logout } from './auth.service.js';

export const authRoutes = Router();

const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export const passwordRule = z.string().min(8, 'Use at least 8 characters').max(200);

const loginLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.store?.id}:${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
  handler: (_req, _res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many sign-in tries. Wait 10 minutes.')),
});

authRoutes.post('/login', loginLimit, validate({ body: loginInput }), async (req, res) => {
  const { email, password } = res.locals.input.body as z.infer<typeof loginInput>;
  const result = await login(req.store.id, email, password, { ip: req.ip, userAgent: req.get('user-agent') });
  res.cookie(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    expires: result.expiresAt,
    path: '/',
  });
  res.set('Cache-Control', 'no-store');
  // token is also returned for non-browser clients (scripts, a future mobile app).
  res.json({ data: { staff: result.staff, token: result.token, expiresAt: result.expiresAt } });
});

authRoutes.post('/logout', requireStaff, async (req, res) => {
  await logout(req.staff!.sessionId);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
});

authRoutes.get('/me', requireStaff, (req, res) => {
  const { id, name, email, role } = req.staff!;
  res.json({ data: { id, name, email, role } });
});

const passwordInput = z.object({ current: z.string().min(1), next: passwordRule });
authRoutes.post('/password', requireStaff, validate({ body: passwordInput }), async (req, res) => {
  const { current, next } = res.locals.input.body as z.infer<typeof passwordInput>;
  await changePassword(req.staff!.id, req.staff!.sessionId, current, next);
  res.status(204).end();
});
