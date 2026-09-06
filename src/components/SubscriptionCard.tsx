"use client";

import Countdown from "./Countdown";
import StatusBadge from "./StatusBadge";
import { formatDateClient, formatPesoClient, type SubscriptionDto } from "@/lib/apiTypes";

interface Props {
  sub: SubscriptionDto;
  onPay: (sub: SubscriptionDto) => void;
}

export default function SubscriptionCard({ sub, onPay }: Props) {
  const billable = !sub.plan.isFree && sub.status !== "PAID" && sub.status !== "CANCELLED";
  const countdownTarget =
    sub.status === "TRIAL" && sub.trialEndsAt
      ? sub.trialEndsAt
      : sub.billingCycleEnd;

  return (
    <div className="card">
      <div className="row">
        <div>
          <strong>{sub.plan.name}</strong>
          <span className="tierchip">{sub.plan.tier}</span>
        </div>
        <StatusBadge
          status={sub.status}
          daysUntilEnd={sub.daysUntilEnd}
          daysUntilTrialEnd={sub.daysUntilTrialEnd}
        />
      </div>

      {sub.plan.description && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
          {sub.plan.description}
        </p>
      )}

      <div className="row mt16">
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>
            {formatPesoClient(sub.amountCents)}
            {!sub.plan.isFree && <span className="muted" style={{ fontSize: 13 }}> /{sub.billingCycle === "ANNUAL" ? "yr" : "mo"}</span>}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {sub.status === "TRIAL" && sub.trialEndsAt
              ? `Trial ends ${formatDateClient(sub.trialEndsAt)}`
              : `Cycle ends ${formatDateClient(sub.billingCycleEnd)}`}
          </div>
        </div>
        {billable && (
          <button className="btn primary" onClick={() => onPay(sub)}>
            Pay now
          </button>
        )}
      </div>

      {billable && <Countdown target={countdownTarget} overdue={sub.status === "OVERDUE"} />}
      {sub.status === "PAID" && (
        <p className="muted mt8" style={{ fontSize: 12 }}>
          Settled for this cycle — next bill on {formatDateClient(sub.billingCycleEnd)}.
        </p>
      )}
    </div>
  );
}
