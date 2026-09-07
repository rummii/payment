"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatDateClient,
  formatPesoClient,
  type ClientDto,
  type PaymentDto,
  type SubscriptionDto,
} from "@/lib/apiTypes";
import SubscriptionCard from "./SubscriptionCard";
import PaymentModal from "./PaymentModal";
import HistoryTable from "./HistoryTable";

export default function Dashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientDto | null>(null);
  const [subs, setSubs] = useState<SubscriptionDto[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<SubscriptionDto | null>(null);

  const load = useCallback(async () => {
    try {
      const [meRes, subRes, payRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/subscriptions"),
        fetch("/api/payments"),
      ]);
      if (meRes.status === 401 || subRes.status === 401) {
        router.push("/login");
        return;
      }
      const me = (await meRes.json()) as { client: ClientDto };
      const subData = (await subRes.json()) as { subscriptions: SubscriptionDto[] };
      const payData = (await payRes.json()) as { payments: PaymentDto[] };
      setClient(me.client);
      setSubs(subData.subscriptions);
      setPayments(payData.payments);
      setError(null);
    } catch {
      setError("Could not load your billing data. Retrying may help.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const unpaid = subs.filter(
    (s) => s.status === "DUE" || s.status === "OVERDUE"
  );
  const dueTotal = unpaid.reduce((sum, s) => sum + s.amountCents, 0);
  const nextDue = unpaid
    .map((s) => s.billingCycleEnd)
    .sort()[0] ?? null;
  const overdueCount = subs.filter((s) => s.status === "OVERDUE").length;

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">Loading your billing overview…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          OSIRIS CENTER <span>Billing</span>
        </div>
        <div className="row">
          {client?.isAdmin && (
            <a className="btn small primary" href="/admin">
              Admin console
            </a>
          )}
          {client && (
            <span className="userline">
              {client.name} · {client.email}
            </span>
          )}
          <button className="btn small" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="stat-row">
        <div className="card stat">
          <div className="label">Total due now</div>
          <div className={`value ${overdueCount > 0 ? "red" : "amber"}`}>
            {formatPesoClient(dueTotal)}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Next due date</div>
          <div className="value amber">{nextDue ? formatDateClient(nextDue) : "—"}</div>
        </div>
        <div className="card stat">
          <div className="label">Active services</div>
          <div className="value green">
            {subs.filter((s) => s.status !== "CANCELLED").length}
          </div>
        </div>
      </div>

      <div className="section-title">Your subscriptions</div>
      <div className="grid">
        {subs.map((sub) => (
          <SubscriptionCard key={sub.id} sub={sub} onPay={setActiveSub} />
        ))}
      </div>

      <div className="section-title">Payment history</div>
      <HistoryTable payments={payments} />

      {activeSub && (
        <PaymentModal
          sub={activeSub}
          onClose={() => setActiveSub(null)}
          onPaid={() => {
            setActiveSub(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
