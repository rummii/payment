# Rummii Payment Portal

Multi-product client billing portal — clients log in, see every active
software subscription (web infrastructure, CRM, inventory portal, custom
apps…), watch a **live countdown** to each cycle due date, and pay via
**GCash QR** or **PayPal** (balance / bank / card). An automated engine
handles trials, free tiers, expiry, renewal reminders (T-10 per spec) and
overdue follow-ups, and exposes a **provisioning API + outbound webhooks +
magic-link SSO** so your website platform can manage billing server-to-server.

## Stack

Next.js 15 (App Router, TypeScript) · Prisma + SQLite (→Postgres-ready) ·
PayPal Orders v2 REST · Xendit / PayMongo GCash adapters · static-QR fallback ·
pdf-lib receipts · Resend/SendGrid/Semaphore notifications · Vitest.

## Quick start

```bash
npm install
cp .env.example .env          # defaults work out of the box (dev mode)
npx prisma migrate dev        # creates SQLite DB + applies schema
npm run db:seed               # demo data
npm run build && npm start    # or: npm run dev
```

Open http://localhost:3000 — **demo@client.ph / PIN 123456**
(the demo client is an admin, so you'll see the **Admin console** link too).

Tests / typecheck:

```bash
npm test        # 42 unit tests (dates, status, lifecycle, channels)
npm run lint    # tsc --noEmit
```

## Admin console

`/admin` (demo client is seeded as admin — grant/revoke under **Clients**).
Every admin route/page is guarded by the session `isAdmin` flag.

| Page | What you can do |
|---|---|
| **Overview** | Collected this month, outstanding due, overdue, trials, recent payments |
| **Verifications** | Review `PENDING_VERIFICATION` GCash/e-wallet payments → **Approve / Reject** (approve advances the billing cycle correctly) |
| **Plans** | The "edit cards" screen — create plans, edit amounts, enable/disable, deactivate |
| **Subscriptions** | Search, edit amount / cycle-end, credit comp cycles, resume/cancel |
| **Payments** | Full ledger with PDF receipts |
| **Clients** | Create (one-time PIN shown once), reset PIN, promote/revoke admin |
| **Payment channels** | **Manage channels** — add/enable/disable, delete custom channels, reorder (tab order), edit static-QR pay-to config. Seeded defaults (GCash QR, PayPal, Maya, GrabPay) are protected from deletion |
| **Webhooks** | Add/test platform endpoints, view signed deliveries, retry failed |
| **Outbox** | Full email/SMS spool (audit trail for both log and live providers) |

## Payment channels (DB-driven multi-channel)

The client payment modal no longer has two hardcoded tabs — it renders one tab
per **enabled** channel from the `PaymentChannel` table, in display order,
restricted to channels whose provider credentials are configured (so you can
never accidentally expose a keyless channel):

| Channel | Provider | Type | Notes |
|---|---|---|---|
| GCash QR | `STATIC_QR` / `XENDIT` | dynamic QR + manual reference | ships enabled |
| Maya | `PAYMONGO` (type `paymaya`) | GCash-family ewallet | inactive until enabled + keyed |
| GrabPay | `PAYMONGO` (type `grabpay`) | ewallet | inactive until enabled + keyed |
| Maribank | `STATIC_QR` | bank transfer QR + reference | seeded (inactive) — flip to enable |
| PayPal | `PAYPAL` | Orders v2 | ships enabled |

Manage them live under **Admin → Payment channels** (enable/disable, reorder,
edit static-QR pay-to config) or via `PATCH /api/admin/channels/:id` — no code
changes or redeploys needed. API keys stay in the server environment, never in
the database. To add a brand-new channel family, add a `PaymentChannel` row +
an adapter in `src/payments/` implementing the gateway interface.

## Payment modes (env-driven, no code changes)

| `GCASH_PROVIDER` | Behaviour | Needs keys |
|---|---|---|
| `static` *(default)* | Dynamic QR rendered locally for the exact bill amount; payer enters the GCash reference number (`AUTO_CONFIRM_STATIC_QR=true` auto-settles in dev, otherwise `PENDING_VERIFICATION`) | No |
| `xendit` | Real dynamic GCash QR via Xendit QR Code API; settles via `x-callback-token`-verified webhook | `XENDIT_API_KEY`, `XENDIT_CALLBACK_TOKEN` |
| `paymongo` | GCash e-wallet source → checkout URL + QR; settles via `source.chargeable` signed webhook | `PAYMONGO_SECRET_KEY` |

PayPal activates when `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (server) and
`NEXT_PUBLIC_PAYPAL_CLIENT_ID` (browser SDK) are set — otherwise the PayPal tab
explains the missing configuration. Settlement = server-side capture
(`/api/payments/paypal/capture`) plus a `PAYMENT.CAPTURE.COMPLETED` webhook
fallback (verified against `PAYPAL_WEBHOOK_ID` when configured).

## Subscription lifecycle

- `Plan.tier` (FREE/STARTER/PRO/ENTERPRISE) and `Plan.trialDays` drive
  free-tier (never billed) and trial flows (`ClientSubscription.TRIAL` +
  `trialEndsAt` → auto-converted by the daily job).
- Billing state is **computed on read** (`PAID / DUE / OVERDUE / TRIAL`) and
  lazily persisted, so countdowns never drift. A settled payment advances the
  calendar-month cycle (e.g. Sep 30 → Oct 31).
- PH calendar (Asia/Manila, UTC+8) math lives in `src/lib/dates.ts`.

## Reminder engine (daily 09:00 PHT)

| Rule | Trigger | Action |
|---|---|---|
| Trial expiring | T-3 / T-1 before `trialEndsAt` | Email + optional SMS + `trial.expiring` webhook |
| Trial expired | trial ended, unpaid | Conversion email (lifecycle job) |
| **Renewal reminder** | **T-10 days before cycle end (spec)** + T-3 | Itemized email + PHP total + portal link |
| Overdue follow-up | 3 / 6 / 9 days overdue | Escalating email |
| Suspension warning | 12 days overdue | Final notice |
| Payment receipt | `payment.succeeded` | Email + PDF receipt link |

All sends dedupe via `ReminderLog`; dev mode spools everything into the
OutboxMessage table (view: `GET /api/dev/outbox`).

Run it three ways: `vercel.json` cron → `POST /api/cron/daily` (guard:
`x-cron-secret`), standalone `npm run remind`, or in-server scheduler
(`ENABLE_IN_SERVER_CRON=true`, `npm run cron`).

## Platform integration (your website ↔ portal)

Authenticate server calls with a `ProvisioningKey` (Bearer token, sha256 at
rest; the seeded dev key is `PROVISIONING_SEED_KEY`):

```bash
# Upsert a client (generates a PIN when omitted)
POST /api/provisioning/clients
  Authorization: Bearer <key>   { "name", "email", "phone?", "pin?" }

# Create a subscription (idempotent per client+plan; trialDays override)
POST /api/provisioning/subscriptions
  { "email", "planSlug", "trialDays?", "amountOverrideCents?", "billingCycle?" }

# Status lookup so your app can gate features
GET /api/provisioning/subscriptions?email=...

# Change amount / cycle / pause, or cancel
PATCH  /api/provisioning/subscriptions/:id    { "amountCents?", "status?" }
DELETE /api/provisioning/subscriptions/:id    # cancel
```

**Outbound webhooks** — register endpoints in the `WebhookEndpoint` table
(`events` = comma-separated or `*`). Payloads are POSTed with
`X-Webhook-Signature: t=<unix>,v1=HMAC_SHA256(secret, t + "." + body)` and an
exponential-backoff retry queue (`WebhookDelivery`, max 5 attempts):
`subscription.created`, `trial.started`, `trial.expiring`, `trial.expired`,
`payment.succeeded`, `payment.failed`, `subscription.renewed`,
`subscription.overdue`, `subscription.cancelled`.

**Magic-link SSO** — your platform calls
`POST /api/provisioning/magic-links { email }` and redirects the user to the
returned one-time URL (15 min TTL); they land on the dashboard
pre-authenticated.

## Client-facing API (portal SPA)

`POST /api/auth/login | logout` · `GET /api/auth/session` ·
`GET /api/me` · `GET /api/subscriptions` · `GET /api/payments` ·
`POST /api/payments/intent { subscriptionId, channelSlug: "gcash-qr"|"paypal"|"maribank"|... }` ·
`POST /api/payments/:ref/confirm { reference }` (GCash) ·
`POST /api/payments/paypal/capture { ref }` ·
`GET /api/channels` (public channel catalog) · `GET /api/payments/:ref` (poll) · `GET /api/payments/:ref/receipt` (PDF).

## Project layout

```
prisma/            schema.prisma · migrations · seed.ts (demo data)
src/app/           SPA (page.tsx, login) + api/* route handlers
src/components/    Dashboard · SubscriptionCard · Countdown · PaymentModal
                   GcashPanel · PaypalPanel · HistoryTable · LoginForm
src/payments/      gateway.ts (interface) · staticGcash · xendit · paymongo · paypal
src/engine/        pure.ts (rules) · lifecycle · reminders · webhooks · dailyJob
src/notifications/ dispatch · email · sms · templates · receipts
src/lib/           auth · db · env · dates (PH calendar) · status · paymentsService
                   receipt (pdf-lib) · provisioning · cronScheduler
src/scripts/       reminder-cron.ts (one-shot) · cron-runner.ts (daemon)
tests/             dates · status · lifecycle · channels (Vitest)
```

## Admin API

```
GET    /api/admin/overview      — MRR-ish stats
GET    /api/admin/channels      — channel list (+ credentialReady flag)
POST   /api/admin/channels      — create custom channel
PATCH  /api/admin/channels/:id  — toggle / reorder / relabel / edit config
DELETE /api/admin/channels/:id  — delete custom channel (defaults protected in UI)
GET    /api/channels            — public, secret-free channel catalog (for SPA)
```
```

## Production notes

- Swap SQLite → Postgres: change `provider` in `schema.prisma` + `DATABASE_URL`.
- Set `AUTH_SECRET`, `CRON_SECRET`, rotate `PROVISIONING_SEED_KEY`-style keys.
- Deploy on Vercel: `vercel.json` schedules the 09:00-PHT cron (01:00 UTC) —
  set the same secrets in project env, including `CRON_SECRET` the platform
  sends as `x-cron-secret`.
- Currency: `PAYPAL_CURRENCY=PHP` (switch to `USD` if your PayPal account
  requires it); GCash amounts are always PHP centavos.


