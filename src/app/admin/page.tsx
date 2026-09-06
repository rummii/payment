"use client";

import { peso, StatCard, Table, dateStr, useApi } from "@/components/admin/ui";

interface Overview {
  stats: {
    clients: number;
    subscriptions: number;
    collectedThisMonthCents: number;
    paymentsThisMonth: number;
    dueTotalCents: number;
    overdueTotalCents: number;
    overdueCount: number;
    trialCount: number;
    activeCount: number;
  };
  recentPayments: Array<{
    ref: string;
    client: string;
    plan: string;
    method: string;
    amountCents: number;
    status: string;
    paymentDate: string | null;
  }>;
}

export default function AdminOverview() {
  const { data, error, loading } = useApi<Overview>("/api/admin/overview");

  if (loading) return <p className="muted">Loading overview…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return null;
  const s = data.stats;

  return (
    <div>
      <div className="stat-row">
        <StatCard label="Collected this month" value={peso(s.collectedThisMonthCents)} tone="green" />
        <StatCard label="Outstanding (due)" value={peso(s.dueTotalCents)} tone="amber" />
        <StatCard label="Overdue" value={`${peso(s.overdueTotalCents)} · ${s.overdueCount} sub${s.overdueCount === 1 ? "" : "s"}`} tone="red" />
      </div>
      <div className="stat-row">
        <StatCard label="Clients" value={s.clients} />
        <StatCard label="Active subscriptions" value={s.activeCount} />
        <StatCard label="On trial" value={s.trialCount} tone="amber" />
        <StatCard label="Payments this month" value={s.paymentsThisMonth} />
      </div>

      <div className="section-title">Recent payments</div>
      <Table headers={["Reference", "Client", "Plan", "Method", "!Amount", "!Date", "Status"]}>
        {data.recentPayments.map((p) => (
          <tr key={p.ref}>
            <td>{p.ref}</td>
            <td>{p.client}</td>
            <td>{p.plan}</td>
            <td className="muted">{p.method}</td>
            <td className="right">{peso(p.amountCents)}</td>
            <td className="muted">{dateStr(p.paymentDate)}</td>
            <td>
              <span className={`badge ${p.status === "PAID" ? "paid" : p.status === "FAILED" ? "failed" : "pending"}`}>
                {p.status.replace(/_/g, " ")}
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
