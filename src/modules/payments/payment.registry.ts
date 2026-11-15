import type { Store } from '../../generated/prisma/client.js';
import type { PaymentMethod } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { getStoreSettings } from '../stores/store-settings.js';
import type { PaymentProvider } from './payment.types.js';
import { codProvider } from './providers/cod.provider.js';

/** Built providers. Add eSewa / Khalti / Fonepay here when they are written. */
const providers: Partial<Record<PaymentMethod, PaymentProvider>> = {
  COD: codProvider,
};

/** Methods this shop has switched on AND that are actually built. */
export function availableProviders(store: Store): PaymentProvider[] {
  const { payments } = getStoreSettings(store);
  return payments.enabled.flatMap((m) => (providers[m] ? [providers[m]] : []));
}

export function getProvider(store: Store, method: PaymentMethod): PaymentProvider {
  const provider = availableProviders(store).find((p) => p.method === method);
  if (!provider) throw AppError.badRequest(`Payment method ${method} is not available`);
  return provider;
}
