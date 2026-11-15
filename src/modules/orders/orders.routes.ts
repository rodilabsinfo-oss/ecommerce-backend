import { type RequestHandler, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { quoteCart } from './cart.service.js';
import { placeOrder } from './checkout.service.js';
import { trackOrder } from './order.queries.js';
import { type CheckoutInput, type QuoteInput, checkoutInput, quoteInput, trackParams, trackQuery } from './orders.schemas.js';

const limit = (windowMinutes: number, max: number) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${req.store?.id}:${req.ip}`,
    handler: (_req, _res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many tries. Please wait a moment.')),
  });

/** Order data is personal: never cached anywhere. */
const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export const cartRoutes = Router();
export const orderRoutes = Router();

/** Current prices, stock and delivery fee for what's in the cart. */
cartRoutes.post('/quote', noStore, limit(1, 60), validate({ body: quoteInput }), async (req, res) => {
  const { items } = res.locals.input.body as QuoteInput;
  res.json({ data: await quoteCart(req.store, items, req.lang) });
});

/**
 * Place an order. Send a fresh `Idempotency-Key` header (any random string)
 * per checkout attempt; retries with the same key return the same order.
 */
orderRoutes.post('/', noStore, limit(10, 10), validate({ body: checkoutInput }), async (req, res) => {
  const key = req.get('idempotency-key')?.trim().slice(0, 80) || undefined;
  const order = await placeOrder(req.store, res.locals.input.body as CheckoutInput, req.lang, key);
  res.status(201).json({ data: order });
});

/** Order status for the buyer: /orders/1001?phone=98XXXXXXXX */
orderRoutes.get(
  '/:orderNumber',
  noStore,
  limit(1, 30),
  validate({ params: trackParams, query: trackQuery }),
  async (req, res) => {
    const { orderNumber } = res.locals.input.params as { orderNumber: number };
    const { phone } = res.locals.input.query as { phone: string };
    res.json({ data: await trackOrder(req.store.id, orderNumber, phone) });
  },
);
