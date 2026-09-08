import { describe, expect, it, vi } from "vitest";
import { PortalApiError, PortalClient } from "../examples/portal-integration/client";

interface FetchCall {
  url: string;
  init: RequestInit;
}

/**
 * Build a fake fetch that returns a JSON response with a given status.
 * `calls` gives typed access to the captured (url, init) pairs.
 */
function jsonFetch(status: number, json: Record<string, unknown>) {
  const fn = vi.fn(
    async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(json), {
        status,
        headers: { "Content-Type": "application/json" },
      })
  );
  return {
    fetch: fn as unknown as typeof fetch,
    calls: () => {
      const out: FetchCall[] = [];
      for (const c of fn.mock.calls) {
        out.push({ url: String(c[0]), init: (c[1] as RequestInit | undefined) ?? {} });
      }
      return out;
    },
  };
}

describe("PortalClient request plumbing", () => {
  it("sends Authorization bearer + JSON and hits the right path", async () => {
    const mock = jsonFetch(201, { created: true, client: { id: "c1" } });
    const client = new PortalClient({
      baseUrl: "https://billing.example.com/",
      provisioningKey: "pk_secret",
      fetchImpl: mock.fetch,
    });

    await client.createClient({ name: "Jane", email: "jane@example.com" });

    const { url, init } = mock.calls()[0];
    expect(url).toBe("https://billing.example.com/api/provisioning/clients");
    expect((init.headers as Record<string, string> | undefined)?.Authorization).toBe(
      "Bearer pk_secret"
    );
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Jane",
      email: "jane@example.com",
    });
  });

  it("normalizes trailing slashes on baseUrl", () => {
    const client = new PortalClient({
      baseUrl: "https://billing.example.com///",
      provisioningKey: "k",
      fetchImpl: jsonFetch(200, {}).fetch,
    });
    expect(client).toBeInstanceOf(PortalClient);
  });

  it("throws PortalApiError with the portal error message on non-2xx", async () => {
    const client = new PortalClient({
      baseUrl: "https://billing.example.com",
      provisioningKey: "pk_secret",
      fetchImpl: jsonFetch(404, { error: "Client not found" }).fetch,
    });

    const err = await client
      .createClient({ name: "X", email: "x@example.com" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PortalApiError);
    expect((err as PortalApiError).status).toBe(404);
    expect((err as PortalApiError).message).toBe("Client not found");
  });
});

describe("PortalClient endpoint mapping", () => {
  it("createSubscription posts email + planSlug", async () => {
    const mock = jsonFetch(201, {
      subscription: { id: "sub1", status: "DUE" },
      created: true,
    });
    const client = new PortalClient({
      baseUrl: "https://billing.example.com",
      provisioningKey: "k",
      fetchImpl: mock.fetch,
    });

    const res = await client.createSubscription({ email: "j@x.com", planSlug: "web-infra" });
    expect(res.created).toBe(true);
    expect(res.subscription.status).toBe("DUE");

    const { url, init } = mock.calls()[0];
    expect(url).toContain("/api/provisioning/subscriptions");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "j@x.com",
      planSlug: "web-infra",
    });
  });

  it("getSubscriptionStatus encodes the email query param", async () => {
    const mock = jsonFetch(200, { client: { id: "c1" }, subscriptions: [] });
    const client = new PortalClient({
      baseUrl: "https://billing.example.com",
      provisioningKey: "k",
      fetchImpl: mock.fetch,
    });

    await client.getSubscriptionStatus("  Jane@Example.COM ");
    const { url } = mock.calls()[0];
    expect(url).toContain("/api/provisioning/subscriptions?email=");
    expect(url).toContain(encodeURIComponent("jane@example.com"));
  });

  it("cancelSubscription hits DELETE", async () => {
    const mock = jsonFetch(200, { subscription: { id: "sub1" }, cancelled: true });
    const client = new PortalClient({
      baseUrl: "https://billing.example.com",
      provisioningKey: "k",
      fetchImpl: mock.fetch,
    });

    const res = await client.cancelSubscription("sub1");
    const { url, init } = mock.calls()[0];
    expect(url).toMatch(/\/subscriptions\/sub1$/);
    expect(init.method).toBe("DELETE");
    expect(res.cancelled).toBe(true);
  });
});