// Outbound webhook publisher — pushes platform events (subscription.created,
// payment.succeeded, …) to registered endpoints with HMAC signatures and an
// exponential-backoff retry queue persisted in WebhookDelivery.

import { createHmac } from "node:crypto";
import { db } from "../lib/db";
import { WebhookDeliveryStatus } from "../lib/constants";

const RETRY_DELAYS_MIN = [5, 15, 60, 360];
const MAX_ATTEMPTS = 5;

function sign(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

function endpointWantsEvent(eventsCsv: string, event: string): boolean {
  if (eventsCsv.trim() === "*") return true;
  return eventsCsv
    .split(",")
    .map((s) => s.trim())
    .includes(event);
}

export async function publishEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const endpoints = (await db.webhookEndpoint.findMany({ where: { isActive: true } })).filter(
    (ep) => endpointWantsEvent(ep.events, event)
  );
  if (endpoints.length === 0) return;
  const body = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString(),
  });
  for (const endpoint of endpoints) {
    const delivery = await db.webhookDelivery.create({
      data: { endpointId: endpoint.id, event, payload: body },
    });
    // Fire-and-forget: failures land in the retry queue.
    void attemptDelivery(delivery.id).catch(() => {});
  }
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.status === WebhookDeliveryStatus.DELIVERED) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(delivery.endpoint.secret, timestamp, delivery.payload);
  try {
    const res = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": delivery.event,
        "X-Webhook-Signature": signature,
      },
      body: delivery.payload,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: WebhookDeliveryStatus.DELIVERED,
        attempts: { increment: 1 },
        deliveredAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
    });
  } catch (err) {
    const attempts = delivery.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    const delayMin = RETRY_DELAYS_MIN[Math.min(attempts - 1, RETRY_DELAYS_MIN.length - 1)];
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted ? WebhookDeliveryStatus.FAILED : WebhookDeliveryStatus.PENDING,
        attempts,
        lastError: String(err),
        nextRetryAt: exhausted ? null : new Date(Date.now() + delayMin * 60_000),
      },
    });
  }
}

/** Re-drive pending deliveries whose backoff window has elapsed. */
export async function retryDueDeliveries(): Promise<number> {
  const due = await db.webhookDelivery.findMany({
    where: { status: WebhookDeliveryStatus.PENDING, nextRetryAt: { lte: new Date() } },
    take: 50,
    orderBy: { createdAt: "asc" },
  });
  for (const d of due) await attemptDelivery(d.id);
  return due.length;
}
