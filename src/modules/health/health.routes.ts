import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

export const healthRoutes = Router();

healthRoutes.get('/', async (_req, res) => {
  let database = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  res.status(database === 'up' ? 200 : 503).json({ status: database === 'up' ? 'ok' : 'degraded', database });
});
