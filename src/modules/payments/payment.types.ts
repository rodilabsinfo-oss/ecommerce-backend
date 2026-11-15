import type { PaymentMethod, PaymentStatus } from '../../generated/prisma/enums.js';

export interface PaymentOrder {
  id: string;
  orderNumber: number;
  /** Amount to collect, in paisa. */
  total: number;
}

/** What the storefront should do after the order is placed. */
export type PaymentNextStep =
  | { type: 'none' } // e.g. COD: just show the thank-you page
  | { type: 'redirect'; url: string } // e.g. Khalti hosted page
  | { type: 'form'; action: string; fields: Record<string, string> }; // e.g. eSewa form post

export interface InitiateResult {
  status: PaymentStatus;
  providerRef?: string;
  providerData?: unknown;
  next: PaymentNextStep;
}

export interface VerifyResult {
  status: PaymentStatus;
  providerRef?: string;
  providerData?: unknown;
}

/**
 * One way of taking money. Adding eSewa or Khalti later means writing one
 * class that implements this and registering it — checkout code does not change.
 */
export interface PaymentProvider {
  readonly method: PaymentMethod;
  readonly label: string;
  /** Called once the order is saved. */
  initiate(order: PaymentOrder): Promise<InitiateResult>;
  /** Called when a wallet sends the buyer back or calls our webhook. Not used by COD. */
  verify?(order: PaymentOrder, payload: Record<string, unknown>): Promise<VerifyResult>;
}
