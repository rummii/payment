// Minimal, dependency-free server-to-server client for the Rummii Payment
// Portal's Provisioning API. Copy this file (or its logic) into your
// website's codebase — it only needs a portal base URL + a provisioning key.
//
// Auth: every request sends `Authorization: Bearer <provisioningKey>`.
// The key is the plaintext of a `ProvisioningKey` row (e.g. the seed key from
// `PROVISIONING_SEED_KEY`); the portal stores only its SHA-256 hash.

import { verifyWebhookSignature } from "./verifyWebhook";

export class PortalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly ref?: string
  ) {
    super(message);
    this.name = "PortalApiError";
  }
}

export interface PortalClientOptions {
  /** e.g. "https://billing.example.com" */
  baseUrl: string;
  /** Bearer token for the provisioning API. */
  provisioningKey: string;
  fetchImpl?: typeof fetch;
}

export interface CreateClientInput {
  name: string;
  email: string;
  phone?: string;
  pin?: string;
}

export interface CreateSubscriptionInput {
  email: string;
  planSlug: string;
  trialDays?: number;
  amountOverrideCents?: number;
  billingCycle?: "MONTHLY" | "ANNUAL";
}

export interface SubscriptionDto {
  id: string;
  status: string;
  amountCents: number;
  billingCycle: string;
  cycleStart: string;
  billingCycleEnd: string;
  trialEndsAt: string | null;
  plan: { slug: string; name: string; isFree: boolean };
}

export class PortalClient {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PortalClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.key = opts.provisioningKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: object
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!res.ok) {
      throw new PortalApiError(
        String(json?.error ?? `Portal request failed (HTTP ${res.status})`),
        res.status
      );
    }
    return json as T;
  }

  /** POST /api/provisioning/clients — upsert a client (your signup). */
  createClient(input: CreateClientInput) {
    return this.request<{
      client: { id: string; email: string; name: string };
      created: boolean;
      generatedPin?: string;
    }>("POST", "/api/provisioning/clients", input);
  }

  /** POST /api/provisioning/subscriptions — idempotent sub creation. */
  createSubscription(input: CreateSubscriptionInput) {
    return this.request<{
      subscription: SubscriptionDto;
      created: boolean;
    }>("POST", "/api/provisioning/subscriptions", input);
  }

  /** GET /api/provisioning/subscriptions?email=… — status lookup. */
  getSubscriptionStatus(email: string) {
    const q = encodeURIComponent(email.trim().toLowerCase());
    return this.request<{
      client: { id: string; name: string; email: string };
      subscriptions: Array<SubscriptionDto & { planSlug: string; planName: string }>;
    }>("GET", `/api/provisioning/subscriptions?email=${q}`);
  }

  /** PATCH /api/provisioning/subscriptions/:id — amount/cycle/status. */
  updateSubscription(
    id: string,
    patch: { amountCents?: number; billingCycle?: "MONTHLY" | "ANNUAL"; status?: string }
  ) {
    return this.request<{ subscription: SubscriptionDto }>(
      "PATCH",
      `/api/provisioning/subscriptions/${encodeURIComponent(id)}`,
      patch
    );
  }

  /** DELETE /api/provisioning/subscriptions/:id — cancel. */
  cancelSubscription(id: string) {
    return this.request<{ subscription: SubscriptionDto; cancelled: boolean }>(
      "DELETE",
      `/api/provisioning/subscriptions/${encodeURIComponent(id)}`
    );
  }

  /** POST /api/provisioning/magic-links — 15-min single-use SSO URL. */
  issueMagicLink(email: string) {
    return this.request<{ url: string; expiresInMinutes: number }>(
      "POST",
      "/api/provisioning/magic-links",
      { email }
    );
  }

  /** Verify an outbound webhook (see verifyWebhook.ts). */
  verifyWebhook(
    secret: string,
    signatureHeader: string | null | undefined,
    rawBody: string,
    opts?: { maxAgeSeconds?: number; maxFutureSkewSeconds?: number }
  ): boolean {
    return verifyWebhookSignature(secret, signatureHeader, rawBody, opts);
  }
}