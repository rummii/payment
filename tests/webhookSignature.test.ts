import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseSignatureHeader,
  verifyWebhookSignature,
} from "../examples/portal-integration/verifyWebhook";

const SECRET = "whsec_test_secret_0123456789";
const BODY = '{"event":"payment.succeeded","payload":{"method":"PAYPAL"}}';

/** Reproduce the portal's exact signing algorithm (src/engine/webhooks.ts). */
function sign(secret: string, body: string, t: number): string {
  const mac = createHmac("sha256", secret)
    .update(`${t}.${body}`)
    .digest("hex");
  return `t=${t},v1=${mac}`;
}

describe("parseSignatureHeader", () => {
  it("parses a well-formed header", () => {
    const sig = sign(SECRET, BODY, 1_700_000_000);
    expect(parseSignatureHeader(sig)).toEqual({
      t: 1_700_000_000,
      v1: createHmac("sha256", SECRET).update(`1700000000.${BODY}`).digest("hex"),
    });
  });

  it("returns null for missing/garbage headers", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("")).toBeNull();
    expect(parseSignatureHeader("t=abc,v1=zzz")).toBeNull();
    expect(parseSignatureHeader("v1=0123")).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  const now = new Date(1_700_000_000 * 1000); // a fixed "now" for tests

  it("accepts a valid signature", () => {
    const sig = sign(SECRET, BODY, 1_700_000_000);
    expect(verifyWebhookSignature(SECRET, sig, BODY, { now })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign(SECRET, BODY, 1_700_000_000);
    expect(verifyWebhookSignature(SECRET, sig, BODY + " ", { now })).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = sign("other-secret", BODY, 1_700_000_000);
    expect(verifyWebhookSignature(SECRET, sig, BODY, { now })).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyWebhookSignature(SECRET, null, BODY, { now })).toBe(false);
  });

  it("rejects a stale (replayed) event past maxAgeSeconds", () => {
    const t = 1_700_000_000 - 301;
    const sig = sign(SECRET, BODY, t);
    expect(verifyWebhookSignature(SECRET, sig, BODY, { now, maxAgeSeconds: 300 })).toBe(false);
  });

  it("accepts an event within maxAgeSeconds", () => {
    const t = 1_700_000_000 - 300;
    const sig = sign(SECRET, BODY, t);
    expect(verifyWebhookSignature(SECRET, sig, BODY, { now, maxAgeSeconds: 300 })).toBe(true);
  });

  it("rejects a timestamp too far in the future (clock skew)", () => {
    const sig = sign(SECRET, BODY, 1_700_000_000 + 61);
    expect(verifyWebhookSignature(SECRET, sig, BODY, { now, maxFutureSkewSeconds: 60 })).toBe(false);
  });
});