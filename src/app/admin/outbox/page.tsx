"use client";

import { dateStr, StateChip, Table, useApi } from "@/components/admin/ui";

interface Message {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  provider: string;
  status: string;
  createdAt: string;
}

export default function OutboxPage() {
  const { data, error, loading } = useApi<{ messages: Message[] }>(
    "/api/admin/outbox"
  );

  if (loading) return <p className="muted">Loading outbox…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <p className="muted" style={{ fontSize: 13 }}>
        Every email/SMS is spooled here before delivery — with the "log" provider
        this is the full notification history; with live providers it doubles as
        the audit trail (SENT / FAILED).
      </p>
      <Table headers={["Channel", "Recipient", "Subject / preview", "Provider", "Status", "!When"]}>
        {(data?.messages ?? []).map((m) => (
          <tr key={m.id}>
            <td>{m.channel}</td>
            <td>{m.recipient}</td>
            <td style={{ maxWidth: 420 }}>
              {(m.subject ?? m.body).slice(0, 90)}
            </td>
            <td className="muted">{m.provider}</td>
            <td><StateChip status={m.status} /></td>
            <td className="muted">{dateStr(m.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
