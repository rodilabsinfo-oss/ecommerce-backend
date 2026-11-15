import type { Store } from '../generated/prisma/client.js';
import type { Lang } from '../lib/i18n.js';
import type { StaffContext } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      /** The shop this request belongs to. Set by resolveStore. */
      store: Store;
      /** Language for names and descriptions. Set by resolveLang. */
      lang: Lang;
      /** Signed-in staff member (admin routes only). Set by requireStaff. */
      staff?: StaffContext;
    }
  }
}

export {};
