"use client";

import {
  formatDateClient,
  formatPesoClient,
  type PaymentDto,
} from "@/lib/apiTypes";
import { METHOD_LABELS } from "@/lib/constants";
import { PaymentStatusChip } from "./StatusBadge";

export default function HistoryTable({ payments }: { payments: PaymentDto[] }) {
  if (payments.length === 0) {
    return <p className="muted">No transactions yet.</p>;
  }
  return (
    <div className="card table-wrap">
      <table className="history">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Plan</th>
            <th>Method</th>
            <th className="right">Amount</th>
            <th>Date</th>
            <th>Status</th>
            <th className="right">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.transactionRef}</td>
              <td>{p.planName}</td>
              <td className="muted">{METHOD_LABELS[p.method] ?? p.method} · {p.provider}</td>
              <td className="right">{formatPesoClient(p.amountCents)}</td>
              <td className="muted">{formatDateClient(p.paymentDate ?? p.createdAt)}</td>
              <td><PaymentStatusChip status={p.status} /></td>
              <td className="right">
                {p.receiptAvailable ? (
                  <a className="btn small" href={`/api/payments/${p.transactionRef}/receipt`}>
                    PDF
                  </a>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
