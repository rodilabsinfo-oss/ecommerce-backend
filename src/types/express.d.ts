import type { Store } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      /** The shop this request belongs to. Set by resolveStore. */
      store: Store;
    }
  }
}

export {};
