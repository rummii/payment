// Pure (DB-free) channel logic — unit-tested in tests/channels.test.ts.

import {
  PayPalConfig,
  PaymongoConfig,
  StaticQrConfig,
  XenditConfig,
} from "../lib/constants";

export interface ChannelCredentialDeps {
  paypalReady: boolean;
  xenditReady: boolean;
  paymongoReady: boolean;
}

/** Whether a channel of this provider can actually take payments. */
export function channelCredentialReady(
  provider: string,
  deps: ChannelCredentialDeps
): boolean {
  switch (provider) {
    case "STATIC_QR":
      return true; // no external credentials needed
    case "PAYPAL":
      return deps.paypalReady;
    case "XENDIT":
      return deps.xenditReady;
    case "PAYMONGO":
      return deps.paymongoReady;
    default:
      return false;
  }
}

export interface StaticPayTo {
  number: string;
  name: string;
}

/**
 * Static-QR pay-to details come from the channel's config JSON, falling back
 * to the environment defaults (GCASH_STATIC_NUMBER / GCASH_STATIC_NAME).
 */
export function staticPayToFromConfig(
  config: Record<string, unknown> | null,
  fallbackNumber: string,
  fallbackName: string
): StaticPayTo {
  const c = config as StaticQrConfig | null;
  const number =
    c?.payTo?.number && c.payTo.number ? c.payTo.number : fallbackNumber;
  const name = c?.payTo?.name && c.payTo.name ? c.payTo.name : fallbackName;
  return { number, name };
}

/** Build a STATIC_QR config object from admin form values. */
export function buildStaticQrConfig(args: {
  number?: string;
  name?: string;
  autoConfirm?: boolean;
  instructions?: string[];
}): StaticQrConfig {
  const config: StaticQrConfig = {};
  if (args.number || args.name) {
    config.payTo = {
      number: args.number ?? "",
      name: args.name ?? "",
    };
  }
  if (args.autoConfirm !== undefined) config.autoConfirm = args.autoConfirm;
  if (args.instructions) config.instructions = args.instructions;
  return config;
}

/** Read auto-confirm setting from a STATIC_QR channel config. */
export function staticAutoConfirm(
  config: Record<string, unknown> | null,
  fallback: boolean
): boolean {
  const c = config as StaticQrConfig | null;
  return c?.autoConfirm ?? fallback;
}

/** Build a PAYPAL experience_context from channel config. */
export function buildPayPalExperienceContext(
  config: Record<string, unknown> | null,
  fallbackBrand: string
): Record<string, unknown> {
  const c = config as PayPalConfig | null;
  const ctx = c?.experienceContext ?? {};
  return {
    brand_name: ctx.brandName || fallbackBrand,
    landing_page: ctx.landingPage || "NO_PREFERENCE",
    shipping_preference: ctx.shippingPreference || "NO_SHIPPING",
    user_action: ctx.userAction || "PAY_NOW",
    payment_method_preference: ctx.paymentMethodPreference || "UNRESTRICTED",
  };
}

/** Read PayPal currency from channel config. */
export function paypalCurrency(
  config: Record<string, unknown> | null,
  fallback: string
): string {
  const c = config as PayPalConfig | null;
  return c?.currency || fallback;
}

/** Build a XENDIT config object from admin form values. */
export function buildXenditConfig(args: {
  apiBase?: string;
  expiresIn?: number;
  qrType?: "DYNAMIC" | "STATIC";
}): XenditConfig {
  return {
    apiBase: args.apiBase,
    expiresIn: args.expiresIn,
    qrType: args.qrType,
  };
}

/** Read XENDIT API base URL from channel config. */
export function xenditApiBase(
  config: Record<string, unknown> | null,
  fallback: string
): string {
  const c = config as XenditConfig | null;
  return c?.apiBase || fallback;
}

/** Read XENDIT QR expiration (seconds) from channel config. */
export function xenditExpiresIn(
  config: Record<string, unknown> | null,
  fallback: number
): number {
  const c = config as XenditConfig | null;
  return c?.expiresIn ?? fallback;
}

/** Build a PAYMONGO config object from admin form values. */
export function buildPaymongoConfig(args: {
  sourceType?: "gcash" | "grabpay" | "paymaya";
  statementDescriptor?: string;
}): PaymongoConfig {
  return {
    sourceType: args.sourceType,
    statementDescriptor: args.statementDescriptor,
  };
}

/** Read PAYMONGO source type from channel config. */
export function paymongoSourceType(
  config: Record<string, unknown> | null,
  fallback: string
): string {
  const c = config as PaymongoConfig | null;
  return c?.sourceType || fallback;
}

export function parseChannelConfig(
  raw: string | null | undefined
): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
