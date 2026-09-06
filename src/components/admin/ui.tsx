"use client";

// Shared building blocks for the admin console (no external deps).

import { useCallback, useEffect, useState } from "react";

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        const json = (await res.json()) as T & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        return json as T;
      })
      .then((json) => {
        if (alive) {
          setData(json);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, tick]);

  return { data, error, loading, reload };
}

export async function adminSend(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export function peso(cents: number): string {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function dateStr(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="card table-wrap">
      <table className="history">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className={h.startsWith("!") ? "right" : ""}>
                {h.replace(/^!/, "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function StateChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "paid",
    TRIAL: "trial",
    DUE: "due",
    OVERDUE: "overdue",
    FREE_ACTIVE: "free",
    CANCELLED: "cancelled",
    PENDING: "pending",
    PENDING_VERIFICATION: "pending",
    FAILED: "failed",
    DELIVERED: "paid",
    REFUNDED: "free",
    SENT: "paid",
    QUEUED: "pending",
  };
  return <span className={`badge ${map[status] ?? "free"}`}>{status.replace(/_/g, " ")}</span>;
}
