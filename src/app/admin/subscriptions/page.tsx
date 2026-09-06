"use client";

import { useState } from "react";
import { adminSend, dateStr, peso, StateChip, Table, useApi } from "@/components/admin/ui";

interface Sub {
  id: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  amountCents: number;
  status: string;
  billingCycle: string;
  cycleStart: string;
  billingCycleEnd: string;
  trialEndsAt: string | null;
}

export default function SubscriptionsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<{ subscriptions: Sub[] }>(
    `/api/admin/subscriptions?query=${encodeURIComponent(query)}`
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patch(sub: Sub, body: Record<string, unknown>, msg: string) {
    setBusyId(sub.id);
    const res = await adminSend(`/api/admin/subscriptions/${sub.id}`, "PATCH", body);
    setBusyId(null);
    setNotice(res.ok ? msg : String(res.data.error));
    reload();
  }

  function compCycle(sub: Sub) {
    const n = window.prompt(`How many cycles to credit for ${sub.planName} (${sub.clientName})?`, "1");
    const parsed = parseInt(n ?? "", 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      patch(sub, { extendCycles: parsed }, `${parsed} cycle(s) credited — cycle end advanced.`);
    }
  }

  function newEnd(sub: Sub) {
    const v = window.prompt(`New cycle end for ${sub.planName} (YYYY-MM-DD):`, sub.billingCycleEnd.slice(0, 10));
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      patch(sub, { billingCycleEnd: v }, "Cycle end updated.");
    }
  }

  function newAmount(sub: Sub) {
    const v = window.prompt(`New monthly amount (PHP) for ${sub.planName}:`, (sub.amountCents / 100).toFixed(2));
    const parsed = parseFloat(v ?? "");
    if (!Number.isNaN(parsed) && parsed >= 0) {
      patch(sub, { amountCents: Math.round(parsed * 100) }, "Amount updated.");
    }
  }

  if (loading) return <p className="muted">Loading subscriptions…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="row mb16">
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Search client name / email / plan…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          {data?.subscriptions.length ?? 0} subscriptions
        </span>
      </div>
      {notice && <div className="success-box">{notice}</div>}
      <Table headers={["Client", "Plan", "!Amount", "Status", "!Cycle end", "!Actions"]}>
        {(data?.subscriptions ?? []).map((s) => (
          <tr key={s.id}>
            <td>
              {s.clientName}
              <div className="muted" style={{ fontSize: 11 }}>{s.clientEmail}</div>
            </td>
            <td>{s.planName}</td>
            <td className="right">{peso(s.amountCents)}</td>
            <td><StateChip status={s.status} /></td>
            <td className="muted">{dateStr(s.billingCycleEnd)}</td>
            <td className="right">
              <button className="btn small" disabled={busyId === s.id} onClick={() => newAmount(s)}>Amount</button>{" "}
              <button className="btn small" disabled={busyId === s.id} onClick={() => newEnd(s)}>Cycle end</button>{" "}
              <button className="btn small" disabled={busyId === s.id} onClick={() => compCycle(s)}>Comp cycle</button>{" "}
              {s.status === "CANCELLED" ? (
                <button className="btn small primary" disabled={busyId === s.id} onClick={() => patch(s, { status: "ACTIVE" }, "Subscription resumed.")}>
                  Resume
                </button>
              ) : (
                <button
                  className="btn small"
                  disabled={busyId === s.id}
                  onClick={() => {
                    if (window.confirm(`Cancel ${s.planName} for ${s.clientName}?`)) {
                      patch(s, { status: "CANCELLED" }, "Subscription cancelled.");
                    }
                  }}
                >
                  Cancel
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
