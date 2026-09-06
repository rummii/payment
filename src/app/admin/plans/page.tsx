"use client";

import { useState } from "react";
import { adminSend, peso, Table, useApi } from "@/components/admin/ui";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: string;
  defaultAmountCents: number;
  billingCycle: string;
  trialDays: number;
  isFree: boolean;
  isActive: boolean;
  subscriptionCount: number;
}

const EMPTY = {
  slug: "",
  name: "",
  description: "",
  tier: "STARTER",
  amount: "0",
  billingCycle: "MONTHLY",
  trialDays: "0",
  isFree: false,
};

export default function PlansPage() {
  const { data, error, loading, reload } = useApi<{ plans: Plan[] }>("/api/admin/plans");
  const [form, setForm] = useState({ ...EMPTY });
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  async function create() {
    const res = await adminSend("/api/admin/plans", "POST", {
      slug: form.slug,
      name: form.name,
      description: form.description || undefined,
      tier: form.tier,
      defaultAmountCents: Math.round(parseFloat(form.amount || "0") * 100),
      billingCycle: form.billingCycle,
      trialDays: parseInt(form.trialDays || "0", 10),
      isFree: form.isFree,
    });
    setNotice(res.ok ? `Plan "${form.name}" created.` : String(res.data.error));
    if (res.ok) {
      setForm({ ...EMPTY });
      reload();
    }
  }

  async function patch(plan: Plan, body: Record<string, unknown>, msg: string) {
    const res = await adminSend(`/api/admin/plans/${plan.id}`, "PATCH", body);
    setNotice(res.ok ? msg : String(res.data.error));
    reload();
  }

  async function deactivate(plan: Plan) {
    if (!window.confirm(`Deactivate "${plan.name}"? Existing subscriptions are preserved.`)) return;
    const res = await adminSend(`/api/admin/plans/${plan.id}`, "DELETE");
    setNotice(res.ok ? `"${plan.name}" deactivated.` : String(res.data.error));
    reload();
  }

  if (loading) return <p className="muted">Loading plans…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>Create a plan</div>
      <div className="card mb16">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          <input className="input" placeholder="slug (e.g. seo-add-on)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="input" placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Tier (STARTER/PRO/ENTERPRISE/FREE)" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value.toUpperCase() })} />
          <input className="input" placeholder="Monthly amount (PHP)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select className="input" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
            <option value="MONTHLY">Monthly</option>
            <option value="ANNUAL">Annual</option>
          </select>
          <input className="input" placeholder="Trial days" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} />
        </div>
        <div className="mt8">
          <input className="input" style={{ width: "100%" }} placeholder="Description (shown on the client card)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="row mt8">
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked })} /> Free tier (never billed)
          </label>
          <button className="btn primary" onClick={create} disabled={!form.slug || !form.name}>
            Create plan
          </button>
        </div>
      </div>

      {notice && <div className="success-box">{notice}</div>}

      <div className="section-title">Plans ({data?.plans.length ?? 0})</div>
      <Table headers={["Plan", "Slug", "Tier", "!Amount", "Trial", "!Subs", "State", "!Actions"]}>
        {(data?.plans ?? []).map((p) => (
          <tr key={p.id}>
            <td>
              <strong>{p.name}</strong>
              {p.description && <div className="muted" style={{ fontSize: 11 }}>{p.description}</div>}
            </td>
            <td className="muted">{p.slug}</td>
            <td>{p.tier}</td>
            <td className="right">
              {p.isFree ? "FREE" : `${peso(p.defaultAmountCents)} / ${p.billingCycle === "ANNUAL" ? "yr" : "mo"}`}
            </td>
            <td>{p.trialDays > 0 ? `${p.trialDays}d` : "—"}</td>
            <td className="right">{p.subscriptionCount}</td>
            <td>
              <span className={`badge ${p.isActive ? "paid" : "cancelled"}`}>
                {p.isActive ? "ACTIVE" : "INACTIVE"}
              </span>
            </td>
            <td className="right">
              {editing?.id === p.id ? (
                <>
                  <input
                    className="input"
                    style={{ width: 110, display: "inline-block", padding: "5px 8px" }}
                    defaultValue={(p.defaultAmountCents / 100).toFixed(2)}
                    id={`amt-${p.id}`}
                  />{" "}
                  <button
                    className="btn small primary"
                    onClick={() => {
                      const el = document.getElementById(`amt-${p.id}`) as HTMLInputElement | null;
                      const v = parseFloat(el?.value ?? "0");
                      patch(p, { defaultAmountCents: Math.round(v * 100) }, "Amount updated.");
                      setEditing(null);
                    }}
                  >
                    Save
                  </button>{" "}
                  <button className="btn small" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn small" onClick={() => setEditing(p)}>Edit amount</button>{" "}
                  <button className="btn small" onClick={() => patch(p, { isActive: !p.isActive }, "State updated.")}>
                    {p.isActive ? "Disable" : "Enable"}
                  </button>{" "}
                  {p.isActive && (
                    <button className="btn small" onClick={() => deactivate(p)}>Deactivate</button>
                  )}
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
