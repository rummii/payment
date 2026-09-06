import { describe, expect, it } from "vitest";
import {
  channelCredentialReady,
  parseChannelConfig,
  staticPayToFromConfig,
} from "@/payments/channelLogic";

const deps = {
  paypalReady: false,
  xenditReady: false,
  paymongoReady: false,
};

describe("channelCredentialReady", () => {
  it("static channels never need credentials", () => {
    expect(channelCredentialReady("STATIC_QR", deps)).toBe(true);
  });

  it("gates each provider on its own credential", () => {
    expect(channelCredentialReady("PAYPAL", deps)).toBe(false);
    expect(channelCredentialReady("PAYPAL", { ...deps, paypalReady: true })).toBe(true);
    expect(channelCredentialReady("XENDIT", { ...deps, xenditReady: true })).toBe(true);
    expect(channelCredentialReady("PAYMONGO", { ...deps, paymongoReady: true })).toBe(true);
  });

  it("unknown providers are never ready", () => {
    expect(channelCredentialReady("DRAGONPAY", { ...deps, paypalReady: true, xenditReady: true, paymongoReady: true })).toBe(false);
  });
});

describe("staticPayToFromConfig", () => {
  it("prefers channel config over env fallback", () => {
    const payTo = staticPayToFromConfig(
      { number: "09181112222", name: "Custom Name" },
      "09170000000",
      "Env Default"
    );
    expect(payTo).toEqual({ number: "09181112222", name: "Custom Name" });
  });

  it("falls back to env defaults for missing/blank fields", () => {
    expect(staticPayToFromConfig(null, "09170000000", "Env Default")).toEqual({
      number: "09170000000",
      name: "Env Default",
    });
    expect(staticPayToFromConfig({ number: "", name: null }, "09170000000", "Env Default")).toEqual({
      number: "09170000000",
      name: "Env Default",
    });
  });
});

describe("parseChannelConfig", () => {
  it("parses JSON objects", () => {
    expect(parseChannelConfig('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns empty for null/invalid", () => {
    expect(parseChannelConfig(null)).toEqual({});
    expect(parseChannelConfig("not-json")).toEqual({});
    expect(parseChannelConfig("[1,2]")).toEqual({});
  });
});
