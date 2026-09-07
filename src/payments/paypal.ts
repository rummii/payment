// PAYPAL — Orders v2 REST client (server-side order create + capture) and
// webhook signature verification. Uses fetch directly against api-m.* so we
// track the current Orders v2 API without the deprecated legacy SDK.

import { randomUUID } from "node:crypto";
import { env, paypalConfigured } from "../lib/env";
import { centsToDecimalString } from "../lib/currency";
import {
  buildPayPalExperienceContext,
  paypalCurrency,
} from "./channelLogic";

const base = () =>
  env.paypal.mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (!paypalConfigured()) {
    throw new Error(
      "PayPal is not configured — set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET"
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${env.paypal.clientId}:${env.paypal.clientSecret}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface CreatePayPalOrderArgs {
  amountCents: number;
  ref: string;
  description: string;
  channelConfig?: Record<string, unknown>;
}

/** Human-readable labels for PayPal error issues. */
const PAYPAL_ERROR_MESSAGES: Record<string, string> = {
  INSTRUMENT_DECLINED:
    "Your payment method was declined. Please try another card or payment method.",
  PAYER_CANNOT_PAY:
    "PayPal was unable to process your payment. Please try again or use a different method.",
  PAYER_ACCOUNT_RESTRICTED:
    "Your PayPal account has restrictions. Please contact PayPal or use another method.",
  ORDER_NOT_APPROVED: "Payment was not approved. Please try again.",
  ORDER_ALREADY_CAPTURED: "This payment has already been captured.",
  TRANSACTION_REFUSED: "The transaction was refused by the issuer.",
};

export function paypalErrorMessage(body: Record<string, unknown> | null): string {
  const details = (body as { details?: Array<{ issue?: string }> } | null)?.details;
  if (details?.length) {
    const issue = details[0].issue ?? "";
    if (PAYPAL_ERROR_MESSAGES[issue]) return PAYPAL_ERROR_MESSAGES[issue];
    return `${issue.replace(/_/g, " ")}. Please try again.`;
  }
  return "PayPal payment failed. Please try again.";
}

export async function createPayPalOrder(
  args: CreatePayPalOrderArgs
): Promise<{ orderId: string; approveUrl?: string }> {
  const token = await getAccessToken();
  const currency = paypalCurrency(args.channelConfig ?? null, env.paypal.currency);
  const experienceContext = buildPayPalExperienceContext(
    args.channelConfig ?? null,
    "Rummii"
  );
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: args.ref,
          custom_id: args.ref,
          description: args.description.slice(0, 127),
          amount: {
            currency_code: currency,
            value: centsToDecimalString(args.amountCents),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: experienceContext,
        },
      },
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(
      `PayPal order create failed: ${paypalErrorMessage(errBody)} (HTTP ${res.status})`
    );
  }
  const order = (await res.json()) as {
    id: string;
    links?: Array<{ rel: string; href: string }>;
  };
  return {
    orderId: order.id,
    approveUrl: order.links?.find((l) => l.rel === "approve")?.href,
  };
}

export interface PayPalCaptureResult {
  status: string;
  captureId?: string;
  referenceId?: string;
}

export async function capturePayPalOrder(
  orderId: string
): Promise<PayPalCaptureResult> {
  const token = await getAccessToken();
  const requestId = randomUUID();
  const res = await fetch(`${base()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      `PayPal capture failed: ${paypalErrorMessage(body)} (HTTP ${res.status})`
    );
  }
  const purchase = (
    body as {
      purchase_units?: Array<{
        reference_id?: string;
        payments?: {
          captures?: Array<{ id: string; status: string }>;
        };
      }>;
    } | null
  )?.purchase_units?.[0];
  const capture = purchase?.payments?.captures?.[0];
  return {
    status: capture?.status ?? "UNKNOWN",
    captureId: capture?.id,
    referenceId: purchase?.reference_id,
  };
}

/**
 * Verify a PayPal webhook via the notifications API. Returns false when
 * credentials/webhook id are unconfigured — callers then log-only (dev).
 */
export async function verifyPayPalWebhook(
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  if (!env.paypal.webhookId || !paypalConfigured()) return false;
  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const res = await fetch(
    `${base()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: env.paypal.webhookId,
        webhook_event: webhookEvent,
      }),
    }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
