// Standalone HMAC-SHA256 webhook signature verifier for the Rummii Payment
// Portal's outbound webhooks. Copy this file (or its logic) into your
// website's codebase — it has zero dependencies on this repository.
//
// The portal POSTs to registered endpoints with:
//   X-Webhook-Event: <event>                     e.g. "payment.succeeded"
//   X-Webhook-Signature: t=<unix>,v1=<hex hmac>  HMAC-SHA256(secret, "<t>.<rawBody>")
//   body: {"event","payload","timestamp"}        the raw JSON, signed as-is
//
// The signing algorithm is the same one this portal uses in
// src/engine/webhooks.ts:
//   createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")

import { createHmac, timingSafeEqual } from "node:crypto";

export interface ParsedSignature {
  /** Unix seconds from the t= component. */
  t: number;
  /** Hex HMAC-SHA256 from the v1= component. */
  v1: string;
}

/**
 * Parse a portal-style signature header ("t=...,v1=...") into its parts.
 * Returns null when a required component is missing or malformed.
 */
export function parseSignatureHeader(
  header: string | null | undefined
): ParsedSignature | null {
  if (!header) return null;
  const t = /(?:^|,)\s*t=(\d+)/.exec(header);
  const v1 = /(?:^|,)\s*v1=([0-9a-f]+)/i.exec(header);
  if (!t || !v1) return null;
  return { t: parseInt(t[1], 10), v1: v1[1] };
}

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/** Constant-time hex compare (timingSafeEqual requires equal-length buffers). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // sha256 hex length is public
  const ba = Buffer.from(a, "ascii");
  const bb = Buffer.from(b, "ascii");
  return timingSafeEqual(ba, bb);
}

export interface VerifyOptions {
  /** Reject events older than this many seconds (default 300). */
  maxAgeSeconds?: number;
  /** Reject timestamps further than this in the future (default 60). */
  maxFutureSkewSeconds?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

/**
 * Verify a portal webhook request.
 *
 * Returns true only when BOTH:
 *   1. the signature header is present/parseable, the timestamp is neither
 *      stale (replay guard) nor unreasonably in the future, and
 *   2. HMAC-SHA256(secret, "<t>.<rawBody>") matches `v1`.
 *
 * `rawBody` MUST be the exact request body string the portal signed — do not
 * re-serialize a parsed JSON object (whitespace/byte order matters).
 */
export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string | null | undefined,
  rawBody: string,
  opts: VerifyOptions = {}
): boolean {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const maxAge = opts.maxAgeSeconds ?? 300;
  const maxSkew = opts.maxFutureSkewSeconds ?? 60;
  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);

  if (parsed.t > nowSec + maxSkew) return false; // far-future / bad clock
  if (nowSec - parsed.t > maxAge) return false; // stale / replay

  const expected = hmacHex(secret, `${parsed.t}.${rawBody}`);
  return safeEqualHex(parsed.v1, expected);
}