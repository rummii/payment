// Pure (DB-free) channel logic — unit-tested in tests/channels.test.ts.

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
  const number =
    typeof config?.number === "string" && config.number
      ? config.number
      : fallbackNumber;
  const name =
    typeof config?.name === "string" && config.name
      ? config.name
      : fallbackName;
  return { number, name };
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
