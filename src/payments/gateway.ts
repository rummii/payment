// GCash QR gateway abstraction. The active adapter is selected via
// GCASH_PROVIDER (static | xendit | paymongo), falling back to `static`
// whenever live credentials are missing.

import { env, gcashProviderName } from "../lib/env";
import { staticGcashGateway } from "./staticGcash";
import { xenditGateway } from "./xendit";
import { paymongoGateway } from "./paymongo";

export interface GcashIntentInput {
  amountCents: number;
  ref: string;
  description: string;
  /** DB-driven channel parameters (provider-specific). */
  channel?: {
    method: string;
    channelType: string;
    config: Record<string, unknown>;
  };
}

export interface GcashIntentResult {
  provider: string;
  /** data:image/png;base64 QR rendered server-side (ready for <img>). */
  qrDataUrl?: string;
  /** Raw QR payload / qr_string (client may re-render if preferred). */
  qrString?: string;
  /** Hosted checkout flow (PayMongo source redirect). */
  checkoutUrl?: string;
  /** Provider object id to store on the Payment row for reconciliation. */
  externalId?: string;
  instructions: string[];
  /** Dev static mode: auto-approve entered references. */
  autoConfirm: boolean;
}

export interface GcashVerifyInput {
  externalId: string | null;
  transactionRef: string;
  channelConfig?: Record<string, unknown>;
}

export interface GcashVerifyResult {
  paid: boolean;
  meta?: Record<string, unknown>;
}

export interface GcashGateway {
  name: string;
  createIntent(input: GcashIntentInput): Promise<GcashIntentResult>;
  /** Best-effort polling — webhooks remain the source of truth. */
  verify?(payment: GcashVerifyInput): Promise<GcashVerifyResult>;
}

export function getGcashGateway(): GcashGateway {
  switch (gcashProviderName()) {
    case "xendit":
      return xenditGateway;
    case "paymongo":
      return paymongoGateway;
    default:
      return staticGcashGateway;
  }
}

/** Resolve the adapter for a DB-driven channel row. */
export function gatewayForProvider(provider: string): GcashGateway {
  switch (provider) {
    case "XENDIT":
      return xenditGateway;
    case "PAYMONGO":
      return paymongoGateway;
    default:
      return staticGcashGateway;
  }
}

export { env };
