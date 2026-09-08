# Portal integration scaffold

Copy-paste examples for connecting **your own website's subscription module**
to the Rummii payment portal. Everything here is dependency-free on this repo
(no imports from `src/`), so you can lift the files straight into your codebase.

Three pieces:

| File | What it does |
|------|--------------|
| `verifyWebhook.ts` | HMAC-SHA256 verifier for the portal's outbound webhooks (replay/staleness guarded, constant-time compare) |
| `client.ts` | Typed server-to-server client for the **Provisioning API** (Bearer-key auth — no user session needed) |
| `receiver.example.ts` | Runnable sample webhook receiver that branches by event + payment method (PayPal vs GCash) |

## 1. Server-to-server (your backend ↔ portal)

```ts
import { PortalClient } from "./client";

const portal = new PortalClient({
  baseUrl: process.env.PORTAL_BASE_URL!,        // e.g. "https://billing.example.com"
  provisioningKey: process.env.PORTAL_KEY!,     // e.g. "pk_demo_change_me" (seed key)
});

// Sign-up on your site → provision the client
const { client } = await portal.createClient({ name, email });

// Your "subscribe" button → create the subscription (idempotent, safe to retry)
const { subscription, created } = await portal.createSubscription({
  email,
  planSlug: "web-infra",
});

// Gate a feature → check current billing state
const { subscriptions } = await portal.getSubscriptionStatus(email);
if (subscriptions.some((s) => s.status === "PAID")) { /* enable */ }

// Change amount / cancel
await portal.updateSubscription(subscription.id, { amountCents: 200000 });
await portal.cancelSubscription(subscription.id);

// SSO hand-off: send the user a single-use 15-minute portal link
const { url } = await portal.issueMagicLink(email);
```

## 2. Webhooks (portal → your backend)

Register your endpoint under **Admin → Webhooks** (or `POST /api/admin/webhooks`)
with the same `secret` you'll verify with. The portal POSTs:

```
POST {your-url}/webhooks/billing
X-Webhook-Event: payment.succeeded
X-Webhook-Signature: t=<unix seconds>,v1=<hex hmac>
{ "event": "payment.succeeded", "payload": { ... }, "timestamp": "..." }
```

Signature format (identical to `src/engine/webhooks.ts`):

```
v1 = HMAC_SHA256(secret, `${t}.${rawBody}`)     // hex; rawBody = exact request bytes
```

```ts
import { verifyWebhookSignature } from "./verifyWebhook";

const ok = verifyWebhookSignature(
  "whsec_...",                 // your shared secret
  req.headers["x-webhook-signature"],
  rawBody,                     // the EXACT byte string, don't re-stringify JSON
  { maxAgeSeconds: 300 }       // drops replays older than 5 min
);
```

Do **not** re-serialize the parsed body when verifying — the signature covers the
original bytes, so read the body once as text and keep that string.

## Payment-method branching (PayPal vs GCash)

`payment.succeeded` / `payment.failed` payloads include `method` and `provider`:

```ts
if (p.method === "PAYPAL")   // provider "PAYPAL"
if (p.method === "GCASH_QR") // provider "STATIC_QR" (or "XENDIT"/"PAYMONGO")
```

See `handleEvent()` in `receiver.example.ts` for a full switch (renewals,
cancellations, failures, trial events).

## Run the example receiver

```bash
PORTAL_WEBHOOK_SECRET=whsec_your_shared_secret npx tsx examples/portal-integration/receiver.example.ts
```

Then point the portal at `http://localhost:8787/`. Every valid event prints a
log line; invalid signatures return **401** (portal treats that as a failure and
retries per its 5/15/60/360-minute schedule).

## Notes

- The **Provisioning API + webhooks** are the server-to-server surface.
  Checkout flows (`POST /api/payments/intent`, PayPal capture, GCash confirm)
  run under a **client session** inside the portal SPA.
- Provisioning keys: the portal stores only the **SHA-256 hash** of each key, so
  save the plaintext on your side. `PROVISIONING_SEED_KEY` seeds the demo key.
- All endpoints return `{ error }` (plus HTTP status) on failure — `PortalClient`
  throws `PortalApiError` carrying that message.