// DB-driven channel factory — resolves PaymentChannel rows into usable
// descriptors, checks credential readiness, and lazily seeds defaults from
// the environment so pre-existing databases keep working.

import { db } from "../lib/db";
import { env, paypalConfigured } from "../lib/env";
import {
  channelCredentialReady,
  parseChannelConfig,
  staticPayToFromConfig,
} from "./channelLogic";

export interface ResolvedChannel {
  id: string;
  slug: string;
  label: string;
  method: string;
  provider: string;
  channelType: string;
  isActive: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  credentialReady: boolean;
}

function credentialDeps() {
  return {
    paypalReady: paypalConfigured(),
    xenditReady: Boolean(env.xendit.apiKey),
    paymongoReady: Boolean(env.paymongo.secretKey),
  };
}

function resolveChannel(row: {
  id: string;
  slug: string;
  label: string;
  method: string;
  provider: string;
  channelType: string;
  isActive: boolean;
  sortOrder: number;
  config: string | null;
}): ResolvedChannel {
  return {
    ...row,
    config: parseChannelConfig(row.config),
    credentialReady: channelCredentialReady(row.provider, credentialDeps()),
  };
}

export async function getAllChannels(): Promise<ResolvedChannel[]> {
  const rows = await db.paymentChannel.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(resolveChannel);
}

export async function getActiveChannels(): Promise<ResolvedChannel[]> {
  const rows = await db.paymentChannel.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(resolveChannel);
}

export async function getChannelBySlug(
  slug: string
): Promise<ResolvedChannel | null> {
  const row = await db.paymentChannel.findUnique({ where: { slug } });
  return row ? resolveChannel(row) : null;
}

/** Public DTO for the client SPA — contains no secrets. */
export function publicChannelDto(ch: ResolvedChannel) {
  const dto: Record<string, unknown> = {
    slug: ch.slug,
    label: ch.label,
    method: ch.method,
    provider: ch.provider,
    credentialReady: ch.credentialReady,
  };
  if (ch.provider === "STATIC_QR") {
    // Pay-to details are public by nature (they're printed on the QR).
    const payTo = staticPayToFromConfig(
      ch.config,
      env.gcash.staticNumber,
      env.gcash.staticName
    );
    dto.payTo = payTo;
  }
  return dto;
}

const DEFAULT_CHANNELS = [
  {
    slug: "gcash-qr",
    label: "GCash QR",
    method: "GCASH_QR",
    provider: "STATIC_QR",
    channelType: "",
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: "paypal",
    label: "PayPal / Card",
    method: "PAYPAL",
    provider: "PAYPAL",
    channelType: "",
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: "maya",
    label: "Maya",
    method: "MAYA",
    provider: "PAYMONGO",
    channelType: "paymaya",
    sortOrder: 3,
    isActive: false,
  },
  {
    slug: "grabpay",
    label: "GrabPay",
    method: "GRABPAY",
    provider: "PAYMONGO",
    channelType: "grabpay",
    sortOrder: 4,
    isActive: false,
  },
];

/**
 * Seed default channel rows (upsert, never overwrites admin edits).
 * Called lazily so pre-existing databases gain the catalog automatically.
 */
export async function ensureDefaultChannels(): Promise<void> {
  for (const ch of DEFAULT_CHANNELS) {
    await db.paymentChannel.upsert({
      where: { slug: ch.slug },
      update: {},
      create: ch,
    });
  }
}
