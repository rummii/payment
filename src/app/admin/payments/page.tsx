"use client";

import { useState } from "react";
import { dateStr, peso, StateChip, Table, useApi } from "@/components/admin/ui";

interface PaymentRow {
  id: string;
  ref: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  method: string;
  provider: string;
  amountCents: number;
  status: string;
  paymentDate: string | null;
  createdAt: string;
}

export default function AdminPaymentsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading } = useApi<{ payments: PaymentRow[] }>(
    `/api/admin/payments?query=${encodeURIComponent(query)}`
  );

  if (loading) return <p className="muted">Loading payments…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="row mb16">
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Search ref / client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          {data?.payments.length ?? 0} payments
        </span>
      </div>
      <Table headers={["Reference", "Client", "Plan", "Method", "!Amount", "!Date", "Status", "!Receipt"]}>
        {(data?.payments ?? []).map((p) => (
          <tr key={p.id}>
            <td>{p.ref}</td>
            <td>
              {p.clientName}
              <div className="muted" style={{ fontSize: 11 }}>{p.clientEmail}</div>
            </td>
            <td>{p.planName}</td>
            <td className="muted">{p.method} · {p.provider}</td>
            <td className="right">{peso(p.amountCents)}</td>
            <td className="muted">{dateStr(p.paymentDate ?? p.createdAt)}</td>
            <td><StateChip status={p.status} /></td>
            <td className="right">
              {p.status === "PAID" ? (
                <a className="btn small" href={`/api/payments/${p.ref}/receipt`}>PDF</a>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
