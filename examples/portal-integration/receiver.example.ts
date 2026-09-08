// Runnable example: receive + verify Rummii portal webhooks, then branch by
// event type and payment method (PayPal vs GCash).
//
// Run with:  npx tsx examples/portal-integration/receiver.example.ts
// Then register this URL in Admin → Webhooks (or POST /api/admin/webhooks),
// using the SAME secret you pass to PORTAL_WEBHOOK_SECRET below.
//
// The portal retries failed deliveries at 5/15/60/360 minutes (max 5), so
// returning anything other than 2xx just delays the next attempt.

import { createServer } from "node:http";
import { verifyWebhookSignature } from "./verifyWebhook";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.PORTAL_WEBHOOK_SECRET ?? "whsec_your_shared_secret";

interface PortalWebhookBody {
  event?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Your business logic — react to a verified event. The portal publishes:
 *   subscription.created | trial.started | trial.expiring | trial.expired |
 *   payment.succeeded | payment.failed | subscription.renewed |
 *   subscription.overdue | subscription.cancelled
 *
 * `payload.method` distinguishes the payment type:
 *   "PAYPAL" | "GCASH_QR" | "MAYA" | "GRABPAY" | "SHOPEEPAY" | "QR_PH" | "MARIBANK"
 */
function handleEvent(json: PortalWebhookBody): void {
  const { event, payload } = json;
  const p = payload ?? {};

  switch (event) {
    case "payment.succeeded": {
      const method = p.method ?? "UNKNOWN";
      console.log(
        `[payment.succeeded] ${p.paymentRef} ${p.amountCents} cents via ${method}`
      );
      if (method === "PAYPAL") {
        toggleFeature(p.subscriptionId as string, "paypal", true);
      } else if (method === "GCASH_QR") {
        toggleFeature(p.subscriptionId as string, "gcash", true);
      }
      break;
    }
    case "payment.failed":
      console.log(
        `[payment.failed] ${p.paymentRef} reason=${p.reason ?? "unknown"}`
      );
      break;
    case "subscription.renewed":
      console.log(
        `[subscription.renewed] ${p.subscriptionId} → ${p.nextCycleStart}..${p.nextCycleEnd}`
      );
      break;
    case "subscription.cancelled":
      console.log(`[subscription.cancelled] ${p.subscriptionId}`);
      break;
    default:
      console.log(`[${event ?? "unknown"}] received (no-op)`);
  }
}

// Stand-in for your website's feature-gate service.
function toggleFeature(subscriptionId: string, feature: string, enabled: boolean): void {
  console.log(`  → set feature "${feature}" = ${enabled} for ${subscriptionId}`);
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  // 1) Read the RAW body — the signature covers the exact bytes.
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString("utf-8");

  // 2) Verify.
  const signature = req.headers["x-webhook-signature"] as string | undefined;
  const ok = verifyWebhookSignature(SECRET, signature, rawBody, {
    maxAgeSeconds: 300, // reject replays older than 5 minutes
  });
  if (!ok) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid signature" }));
    return;
  }

  // 3) Handle.
  try {
    const json = JSON.parse(rawBody) as PortalWebhookBody;
    handleEvent(json);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: true, event: json.event }));
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Bad JSON: ${String(e)}` }));
  }
});

server.listen(PORT, () => {
  console.log(
    `Example portal webhook receiver listening on :${PORT}\n` +
      `Point the portal's webhook at http://<this-host>${PORT === 80 ? "" : ":" + PORT}/ ` +
      `with secret "${SECRET}"`
  );
});