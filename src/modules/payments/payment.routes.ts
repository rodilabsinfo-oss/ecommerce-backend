import { Router } from 'express';
import { availableProviders } from './payment.registry.js';

export const paymentRoutes = Router();

/** Payment options to show at checkout. */
paymentRoutes.get('/methods', (req, res) => {
  res.json({ data: availableProviders(req.store).map(({ method, label }) => ({ method, label })) });
});
