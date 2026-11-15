import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { routes } from './routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Photos saved by the local storage driver (development). In production use S3/R2 + a CDN.
  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static('uploads', { maxAge: '30d', immutable: true, fallthrough: false }));
  }
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
