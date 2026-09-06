// Server-to-server auth for the provisioning API + cron secret check.

import type { NextRequest } from "next/server";
import { db } from "./db";
import { safeEqual, sha256 } from "./hash";
import { env } from "./env";

export type ProvisioningAuthResult =
  | { ok: true; keyId: string }
  | { ok: false; status: number; error: string };

export async function requireProvisioningKey(
  req: NextRequest
): Promise<ProvisioningAuthResult> {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const key = match?.[1]?.trim();
  if (!key) {
    return { ok: false, status: 401, error: "Missing bearer provisioning key" };
  }
  const record = await db.provisioningKey.findUnique({
    where: { keyHash: sha256(key) },
  });
  if (!record || !record.isActive) {
    return { ok: false, status: 401, error: "Invalid provisioning key" };
  }
  await db.provisioningKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { ok: true, keyId: record.id };
}

export function provisioningErrorResponse(
  result: Extract<ProvisioningAuthResult, { ok: false }>
): Response {
  return Response.json({ error: result.error }, { status: result.status });
}

/** Cron routes accept the secret via header or query param. */
export function checkCronSecret(req: NextRequest): boolean {
  const provided =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret") ??
    "";
  if (!env.cronSecret || !provided) return false;
  return safeEqual(provided, env.cronSecret);
}
