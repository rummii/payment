"use client";

import { useState } from "react";
import { adminSend, dateStr, Table, useApi } from "@/components/admin/ui";

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  subscriptionCount: number;
  createdAt: string;
}

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<{ clients: ClientRow[] }>(
    `/api/admin/clients?query=${encodeURIComponent(query)}`
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", isAdmin: false });

  async function create() {
    const res = await adminSend("/api/admin/clients", "POST", form);
    setNotice(
      res.ok
        ? `Client created.${res.data.generatedPin ? ` One-time PIN: ${res.data.generatedPin}` : ""}`
        : String(res.data.error)
    );
    if (res.ok) {
      setForm({ name: "", email: "", phone: "", isAdmin: false });
      reload();
    }
  }

  async function patch(c: ClientRow, body: Record<string, unknown>, msg: string) {
    const res = await adminSend(`/api/admin/clients/${c.id}`, "PATCH", body);
    setNotice(res.ok ? msg : String(res.data.error));
    reload();
  }

  async function resetPin(c: ClientRow) {
    if (!window.confirm(`Reset the PIN for ${c.email}?`)) return;
    const res = await adminSend(`/api/admin/clients/${c.id}`, "PATCH", { action: "reset-pin" });
    setNotice(res.ok ? `New one-time PIN: ${res.data.resetPin}` : String(res.data.error));
  }

  if (loading) return <p className="muted">Loading clients…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>Create client</div>
      <div className="card mb16">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="row mt8">
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} /> Grant admin access
          </label>
          <button className="btn primary" onClick={create} disabled={!form.name || !form.email}>
            Create client
          </button>
        </div>
      </div>

      {notice && <div className="success-box">{notice}</div>}

      <div className="row mb16">
        <input className="input" style={{ maxWidth: 360 }} placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted" style={{ fontSize: 13 }}>{data?.clients.length ?? 0} clients</span>
      </div>

      <Table headers={["Client", "Phone", "!Subscriptions", "Joined", "!Actions"]}>
        {(data?.clients ?? []).map((c) => (
          <tr key={c.id}>
            <td>
              {c.name} {c.isAdmin && <span className="badge trial">ADMIN</span>}
              <div className="muted" style={{ fontSize: 11 }}>{c.email}</div>
            </td>
            <td className="muted">{c.phone ?? "—"}</td>
            <td className="right">{c.subscriptionCount}</td>
            <td className="muted">{dateStr(c.createdAt)}</td>
            <td className="right">
              <button className="btn small" onClick={() => resetPin(c)}>Reset PIN</button>{" "}
              <button
                className="btn small"
                onClick={() => patch(c, { isAdmin: !c.isAdmin }, c.isAdmin ? "Admin access revoked." : "Admin access granted.")}
              >
                {c.isAdmin ? "Revoke admin" : "Make admin"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
