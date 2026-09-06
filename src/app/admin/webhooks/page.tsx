"use client";

import { useState } from "react";
import { adminSend, dateStr, StateChip, Table, useApi } from "@/components/admin/ui";

interface Delivery {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface Endpoint {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
  recentDeliveries: Delivery[];
}

export default function WebhooksPage() {
  const { data, error, loading, reload } = useApi<{ endpoints: Endpoint[] }>(
    "/api/admin/webhooks"
  );
  const { data: deliveriesData, reload: reloadDeliveries } = useApi<{
    deliveries: Delivery[];
  }>("/api/admin/webhooks/deliveries");
  const [notice, setNotice] = useState<string | null>(null);

  async function addEndpoint() {
    const url = window.prompt("Endpoint URL (https://…):");
    if (!url) return;
    const events = window.prompt("Events (comma-separated or *):", "*") ?? "*";
    const res = await adminSend("/api/admin/webhooks", "POST", { url, events });
    setNotice(
      res.ok
        ? `Endpoint added.${res.data.endpoint && typeof res.data.endpoint === "object" && "secret" in (res.data.endpoint as Record<string, unknown>) ? ` Signing secret (copy now): ${(res.data.endpoint as Record<string, unknown>).secret}` : ""}`
        : String(res.data.error)
    );
    reload();
  }

  async function toggle(e: Endpoint) {
    const res = await adminSend(`/api/admin/webhooks/${e.id}`, "PATCH", { isActive: !e.isActive });
    setNotice(res.ok ? "Endpoint updated." : String(res.data.error));
    reload();
  }

  async function remove(e: Endpoint) {
    if (!window.confirm(`Delete endpoint ${e.url}?`)) return;
    const res = await adminSend(`/api/admin/webhooks/${e.id}`, "DELETE");
    setNotice(res.ok ? "Endpoint deleted." : String(res.data.error));
    reload();
  }

  async function retryAll() {
    const res = await adminSend("/api/admin/webhooks/deliveries", "POST", {});
    setNotice(res.ok ? `Retried ${(res.data as { retried?: number }).retried ?? 0} due delivery(ies).` : String(res.data.error));
    reloadDeliveries();
    reload();
  }

  if (loading) return <p className="muted">Loading webhooks…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="row mb16">
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Events are POSTed with <code>X-Webhook-Signature: t=…,v1=HMAC</code> and retried
          with backoff (max 5 attempts).
        </p>
        <div>
          <button className="btn primary" onClick={addEndpoint}>+ Add endpoint</button>{" "}
          <button className="btn" onClick={retryAll}>Retry due</button>
        </div>
      </div>
      {notice && <div className="success-box">{notice}</div>}

      {(data?.endpoints ?? []).map((e) => (
        <div className="card mb16" key={e.id}>
          <div className="row">
            <div>
              <strong>{e.url}</strong>
              <div className="muted" style={{ fontSize: 12 }}>
                events: {e.events} · added {dateStr(e.createdAt)}
              </div>
            </div>
            <div>
              <span className={`badge ${e.isActive ? "paid" : "cancelled"}`}>
                {e.isActive ? "ACTIVE" : "INACTIVE"}
              </span>{" "}
              <button className="btn small" onClick={() => toggle(e)}>
                {e.isActive ? "Disable" : "Enable"}
              </button>{" "}
              <button className="btn small" onClick={() => remove(e)}>Delete</button>
            </div>
          </div>
          {e.recentDeliveries.length > 0 && (
            <div className="mt8 muted" style={{ fontSize: 12 }}>
              Recent:{" "}
              {e.recentDeliveries
                .map((d) => `${d.event} (${d.status}, try ${d.attempts})`)
                .join(" · ")}
            </div>
          )}
        </div>
      ))}

      <div className="section-title">Delivery log</div>
      <Table headers={["Event", "Status", "!Attempts", "Error", "!When"]}>
        {(deliveriesData?.deliveries ?? []).map((d) => (
          <tr key={d.id}>
            <td>{d.event}</td>
            <td><StateChip status={d.status} /></td>
            <td className="right">{d.attempts}</td>
            <td className="muted" style={{ fontSize: 11 }}>{d.lastError ?? "—"}</td>
            <td className="muted">{dateStr(d.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
