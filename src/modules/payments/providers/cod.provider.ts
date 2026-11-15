import type { PaymentProvider } from '../payment.types.js';

/**
 * Cash on delivery. Nothing to do at checkout; the payment stays PENDING
 * until staff mark the order delivered and the cash is collected.
 */
export const codProvider: PaymentProvider = {
  method: 'COD',
  label: 'Cash on Delivery',
  async initiate() {
    return { status: 'PENDING', next: { type: 'none' } };
  },
};
