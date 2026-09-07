// PAYMONGO — GCash e-wallet source (checkout flow). The source's checkout_url
// is surfaced as both a link and a scannable QR. Settlement source of truth:
// `source.chargeable` webhook delivered to /api/webhooks/paymongo.

import QRCode from "qrcode";
import { env } from "../lib/env";
import { formatPeso } from "../lib/currency";
import { paymongoSourceType } from "./channelLogic";
import type {
  GcashGateway,
  GcashIntentInput,
  GcashIntentResult,
} from "./gateway";

const API = "https://api.paymongo.com/v1";

function authHeader(): string {
  return "Basic " + Buffer.from(`${env.paymongo.secretKey}:`).toString("base64");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}

export const paymongoGateway: GcashGateway = {
  name: "PAYMONGO",

  async createIntent(input): Promise<GcashIntentResult> {
    const sourceType = paymongoSourceType(input.channel?.config ?? null, "gcash");
    const res = await fetch(`${API}/sources`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: input.amountCents,
            currency: "PHP",
            // DB-driven channel type: "gcash" | "grabpay" | "paymaya" | …
            type: sourceType,
            redirect: {
              success: `${env.appUrl}/?payment=success&ref=${input.ref}`,
              failed: `${env.appUrl}/?payment=failed&ref=${input.ref}`,
            },
            metadata: { ref: input.ref, description: input.description },
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`PayMongo source failed ${res.status}: ${await safeText(res)}`);
    }
    const data = (await res.json()) as {
      data: { id: string; attributes: { checkout_url?: string } };
    };
    const checkoutUrl = data.data.attributes.checkout_url ?? "";
    const qrDataUrl = checkoutUrl
      ? await QRCode.toDataURL(checkoutUrl, { width: 480, margin: 2 })
      : undefined;
    return {
      provider: "PAYMONGO",
      checkoutUrl,
      qrDataUrl,
      externalId: data.data.id,
      autoConfirm: false,
      instructions: [
        `Open the GCash app and pay PHP ${formatPeso(input.amountCents)} for reference ${input.ref}.`,
        "Scan the QR above or open the GCash checkout link on your phone.",
        "Approve the payment inside the GCash app / checkout page.",
        "This page updates automatically once PayMongo confirms the payment.",
      ],
    };
  },

  async verify(payment) {
    if (!payment.externalId) return { paid: false };
    const res = await fetch(`${API}/sources/${payment.externalId}`, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) return { paid: false, meta: { pollStatus: res.status } };
    const data = (await res.json()) as {
      data: { attributes: { status?: string } };
    };
    const status = data.data.attributes.status;
    return { paid: status === "chargeable", meta: { status } };
  },
};
