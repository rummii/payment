// STATIC_QR — custom dynamic QR display module with manual reference entry.
// Generates a QR for the exact bill amount without any external gateway
// credentials; settlement is confirmed by the payer entering their GCash
// reference number (optionally auto-approved in development).

import QRCode from "qrcode";
import { env } from "../lib/env";
import { METHOD_LABELS } from "../lib/constants";
import { centsToDecimalString } from "../lib/currency";
import {
  staticAutoConfirm,
  staticPayToFromConfig,
} from "./channelLogic";
import type {
  GcashGateway,
  GcashIntentInput,
  GcashIntentResult,
} from "./gateway";

function buildPayload(
  input: GcashIntentInput,
  payTo: { number: string; name: string }
): string {
  return [
    "EWALLET",
    `PAYTO:${payTo.name}`,
    `NUM:${payTo.number}`,
    `AMOUNT:PHP${centsToDecimalString(input.amountCents)}`,
    `REF:${input.ref}`,
  ].join("|");
}

export const staticGcashGateway: GcashGateway = {
  name: "STATIC_QR",

  async createIntent(input): Promise<GcashIntentResult> {
    const payTo = staticPayToFromConfig(
      input.channel?.config ?? null,
      env.gcash.staticNumber,
      env.gcash.staticName
    );
    const methodLabel = METHOD_LABELS[input.channel?.method ?? ""] ?? "e-wallet";
    const payload = buildPayload(input, payTo);
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const autoConfirm = staticAutoConfirm(
      input.channel?.config ?? null,
      env.gcash.autoConfirmStaticQr
    );
    // Allow per-channel custom instructions, else generate defaults.
    const cfg = (input.channel?.config ?? {}) as {
      instructions?: string[];
    };
    const instructions = cfg.instructions?.length
      ? cfg.instructions
      : [
          `Open your ${methodLabel} app and tap Scan QR Code.`,
          `Scan the QR above — or manually send to ${payTo.number} (${payTo.name}).`,
          `Pay the exact amount of PHP ${centsToDecimalString(input.amountCents)} for reference ${input.ref}.`,
          "Enter the reference number from your receipt below, then submit.",
        ];
    return {
      provider: "STATIC_QR",
      qrDataUrl,
      qrString: payload,
      autoConfirm,
      instructions,
    };
  },
};

