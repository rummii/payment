// XENDIT — real dynamic GCash QR via the Xendit QR Code API.
// Docs: https://developers.xendit.co/api-reference/#qr-codes
// Settlement source of truth: `QR_PAYMENT`/`payment.succeeded` callback
// delivered to /api/webhooks/xendit with the x-callback-token header.

import QRCode from "qrcode";
import { env } from "../lib/env";
import type {
  GcashGateway,
  GcashIntentInput,
  GcashIntentResult,
} from "./gateway";

function authHeader(): string {
  // Xendit uses HTTP Basic auth with the secret API key as the username.
  return "Basic " + Buffer.from(`${env.xendit.apiKey}:`).toString("base64");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}

export const xenditGateway: GcashGateway = {
  name: "XENDIT",

  async createIntent(input): Promise<GcashIntentResult> {
    if (input.channel?.channelType && input.channel.channelType !== "GCASH") {
      throw new Error(
        `XENDIT provider supports only the GCASH QR channel (got "${input.channel.channelType}")`
      );
    }
    const res = await fetch(`${env.xendit.apiBase}/qr_codes`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        "X-API-VERSION": "2023-11-29",
      },
      body: JSON.stringify({
        reference_id: input.ref,
        type: "DYNAMIC",
        currency: "PHP",
        amount: input.amountCents / 100,
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        metadata: { description: input.description },
      }),
    });
    if (!res.ok) {
      throw new Error(`Xendit QR creation failed ${res.status}: ${await safeText(res)}`);
    }
    const data = (await res.json()) as {
      id: string;
      qr_string?: string;
    };
    const qrString = data.qr_string ?? "";
    const qrDataUrl = qrString
      ? await QRCode.toDataURL(qrString, { width: 480, margin: 2 })
      : undefined;
    return {
      provider: "XENDIT",
      qrDataUrl,
      qrString,
      externalId: data.id,
      autoConfirm: false,
      instructions: [
        "Open the GCash app and tap Scan QR Code (or Pay QR).",
        "Scan the dynamic QR code above — the amount is pre-filled.",
        "Confirm the payment inside the GCash app.",
        "This page updates automatically once GCash settles the payment.",
      ],
    };
  },

  /** Best-effort poll; the webhook remains authoritative. */
  async verify(payment) {
    if (!payment.externalId) return { paid: false };
    const res = await fetch(
      `${env.xendit.apiBase}/qr_codes/${payment.externalId}`,
      { headers: { Authorization: authHeader(), "X-API-VERSION": "2023-11-29" } }
    );
    if (!res.ok) return { paid: false, meta: { pollStatus: res.status } };
    const data = (await res.json()) as { status?: string; amount_paid?: number };
    return {
      paid: data.amount_paid !== undefined && data.amount_paid > 0,
      meta: { status: data.status },
    };
  },
};
