"use client";

import { useState } from "react";
import { adminSend, Table, useApi } from "@/components/admin/ui";

interface Channel {
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

/** Seeded channels cannot be deleted (only disabled) to avoid breaking defaults. */
const DEFAULT_CHANNEL_SLUGS = new Set(["gcash-qr", "paypal", "maya", "grabpay"]);
function isDefaultChannel(slug: string): boolean {
  return DEFAULT_CHANNEL_SLUGS.has(slug);
}

export default function ChannelsPage() {
  const { data, error, loading, reload } = useApi<{ channels: Channel[] }>(
    "/api/admin/channels"
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(c: Channel, body: Record<string, unknown>, msg: string) {
    setBusyId(c.id);
    const res = await adminSend(`/api/admin/channels/${c.id}`, "PATCH", body);
    setBusyId(null);
    setNotice(res.ok ? msg : String(res.data.error));
    reload();
  }

  function editConfig(c: Channel) {
    const raw = window.prompt(
      `Config JSON for ${c.label} (e.g. {"number":"0917…","name":"Rummii"}) — non-secret only:`,
      JSON.stringify(c.config ?? {}, null, 0)
    );
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      patch(c, { config: parsed }, "Channel config saved.");
    } catch {
      setNotice("Invalid JSON.");
    }
  }

  function reorder(c: Channel) {
    const v = window.prompt(`Display order for ${c.label} (lower = earlier tab):`, String(c.sortOrder));
    const parsed = parseInt(v ?? "", 10);
    if (!Number.isNaN(parsed)) {
      patch(c, { sortOrder: parsed }, "Display order saved.");
    }
  }

  async function remove(c: Channel) {
    if (!window.confirm(`Delete the "${c.label}" channel? This cannot be undone.`)) return;
    setBusyId(c.id);
    const res = await adminSend(`/api/admin/channels/${c.id}`, "DELETE");
    setBusyId(null);
    setNotice(res.ok ? `Channel "${c.label}" deleted.` : String(res.data.error));
    reload();
  }

  function addChannel() {
    const slug = window.prompt("New channel slug (a-z, 0-9, dashes):");
    if (!slug) return;
    const label = window.prompt("Display label (tab name):");
    if (!label) return;
    const method = (window.prompt("Method (GCASH_QR / MAYA / GRABPAY / SHOPEEPAY / QR_PH):", "MAYA") ?? "").toUpperCase();
    const provider = (window.prompt("Provider (PAYMONGO / XENDIT / STATIC_QR):", "PAYMONGO") ?? "").toUpperCase();
    const channelType = window.prompt("Provider channel type (e.g. paymaya / grabpay / gcash):", "") ?? "";
    adminSend("/api/admin/channels", "POST", { slug, label, method, provider, channelType })
      .then((res) => {
        setNotice(res.ok ? `Channel "${label}" created (disabled — enable it once credentials are set).` : String(res.data.error));
        reload();
      });
  }

  if (loading) return <p className="muted">Loading channels…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="row mb16">
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Tabs in the client payment modal render top-to-bottom in display order for
          every <strong>enabled</strong> channel with ready credentials. API keys live in
          the server environment — never stored here.
        </p>
        <button className="btn primary" onClick={addChannel}>+ Add channel</button>
      </div>
      {notice && <div className="success-box">{notice}</div>}
      <Table headers={["Channel", "Method", "Provider", "!Order", "Credentials", "State", "!Actions"]}>
        {(data?.channels ?? []).map((c) => (
          <tr key={c.id}>
            <td>
              <strong>{c.label}</strong>
              <div className="muted" style={{ fontSize: 11 }}>{c.slug}</div>
            </td>
            <td>{c.method}</td>
            <td className="muted">
              {c.provider}
              {c.channelType ? ` · ${c.channelType}` : ""}
            </td>
            <td className="right">{c.sortOrder}</td>
            <td>
              <span className={`badge ${c.credentialReady ? "paid" : "failed"}`}>
                {c.credentialReady ? "READY" : "MISSING KEYS"}
              </span>
            </td>
            <td>
              <span className={`badge ${c.isActive ? "paid" : "cancelled"}`}>
                {c.isActive ? "ENABLED" : "DISABLED"}
              </span>
            </td>
            <td className="right">
              <button
                className="btn small primary"
                disabled={busyId === c.id}
                onClick={() => patch(c, { isActive: !c.isActive }, c.isActive ? "Channel disabled." : "Channel enabled.")}
              >
                {c.isActive ? "Disable" : "Enable"}
              </button>{" "}
              <button className="btn small" onClick={() => reorder(c)}>Order</button>{" "}
              {c.provider === "STATIC_QR" && (
                <button className="btn small" onClick={() => editConfig(c)}>Config</button>
              )}{" "}
              {!isDefaultChannel(c.slug) && (
                <button
                  className="btn small"
                  disabled={busyId === c.id}
                  onClick={() => remove(c)}
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.5)" }}
                >
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
