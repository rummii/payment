"use client";

import { useState } from "react";
import { adminSend, dateStr, peso, Table, useApi } from "@/components/admin/ui";

interface Verification {
  id: string;
  ref: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  amountCents: number;
  method: string;
  provider: string;
  status: string;
  reference: string | null;
  submittedAt: string;
}

export default function VerificationsPage() {
  const { data, error, loading, reload } = useApi<{ verifications: Verification[] }>(
    "/api/admin/verifications"
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(v: Verification, action: "approve" | "reject") {
    let reference = v.reference ?? "";
    if (action === "approve" && !reference) {
      reference = window.prompt(`Reference number for ${v.ref}:`) ?? "";
      if (!reference.trim()) return;
    }
    if (action === "reject") {
      const reason = window.prompt(`Reason for rejecting ${v.ref}:`) ?? "Rejected by admin";
      setBusyId(v.id);
      const res = await adminSend(`/api/admin/verifications/${v.id}`, "POST", {
        action,
        reason,
      });
      setBusyId(null);
      setNotice(res.ok ? `${v.ref} rejected.` : String(res.data.error));
      reload();
      return;
    }
    setBusyId(v.id);
    const res = await adminSend(`/api/admin/verifications/${v.id}`, "POST", {
      action,
      reference: reference.trim(),
    });
    setBusyId(null);
    setNotice(res.ok ? `${v.ref} approved — subscription marked PAID and cycle advanced.` : String(res.data.error));
    reload();
  }

  if (loading) return <p className="muted">Loading queue…</p>;
  if (error) return <div className="error-box">{error}</div>;

  const items = data?.verifications ?? [];
  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>
        Manual verification queue ({items.length})
      </div>
      {notice && <div className="success-box">{notice}</div>}
      {items.length === 0 ? (
        <p className="muted">Nothing waiting for review. 🎉</p>
      ) : (
        <Table headers={["Reference", "Client", "Plan", "Payer reference", "!Amount", "Submitted", "Status", "!Actions"]}>
          {items.map((v) => (
            <tr key={v.id}>
              <td>{v.ref}</td>
              <td>
                {v.clientName}
                <div className="muted" style={{ fontSize: 11 }}>{v.clientEmail}</div>
              </td>
              <td>{v.planName}</td>
              <td>{v.reference ?? <span className="muted">—</span>}</td>
              <td className="right">{peso(v.amountCents)}</td>
              <td className="muted">{dateStr(v.submittedAt)}</td>
              <td>
                <span className="badge pending">{v.status.replace(/_/g, " ")}</span>
              </td>
              <td className="right">
                <button
                  className="btn small primary"
                  disabled={busyId === v.id}
                  onClick={() => act(v, "approve")}
                >
                  Approve
                </button>{" "}
                <button
                  className="btn small"
                  disabled={busyId === v.id}
                  onClick={() => act(v, "reject")}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
