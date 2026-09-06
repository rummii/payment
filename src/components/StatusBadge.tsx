"use client";

import type { DisplayStatusDto } from "@/lib/apiTypes";

interface Props {
  status: DisplayStatusDto;
  daysUntilEnd: number;
  daysUntilTrialEnd: number | null;
}

export default function StatusBadge({ status, daysUntilEnd, daysUntilTrialEnd }: Props) {
  switch (status) {
    case "PAID":
      return <span className="badge paid">PAID</span>;
    case "DUE": {
      const label =
        daysUntilEnd <= 0 ? "DUE TODAY" : `DUE IN ${daysUntilEnd} DAY${daysUntilEnd === 1 ? "" : "S"}`;
      return <span className="badge due">{label}</span>;
    }
    case "OVERDUE": {
      const d = Math.abs(daysUntilEnd);
      return <span className="badge overdue">OVERDUE {d}D</span>;
    }
    case "TRIAL": {
      const d = daysUntilTrialEnd ?? 0;
      return <span className="badge trial">TRIAL · {d} DAY{d === 1 ? "" : "S"} LEFT</span>;
    }
    case "FREE_ACTIVE":
      return <span className="badge free">FREE TIER</span>;
    case "CANCELLED":
      return <span className="badge cancelled">CANCELLED</span>;
    default:
      return <span className="badge free">{status}</span>;
  }
}

export function PaymentStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "paid",
    PENDING: "pending",
    PENDING_VERIFICATION: "pending",
    FAILED: "failed",
    REFUNDED: "free",
  };
  return <span className={`badge ${map[status] ?? "free"}`}>{status.replace("_", " ")}</span>;
}
