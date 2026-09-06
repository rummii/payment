"use client";

// GCash QR payment panel — displays the dynamic QR for the exact bill
// amount, step-by-step instructions, manual reference entry, and polls
// the payment status until settlement.

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPesoClient, type SubscriptionDto } from "@/lib/apiTypes";

interface ChannelDto {
  slug: string;
  label: string;
  method: string;
  provider: string;
}

interface Intent {
  qrDataUrl: string | null;
  checkoutUrl: string | null;
  instructions: string[];
  autoConfirm: boolean;
  manualReference: boolean;
  provider: string;
}

interface Props {
  sub: SubscriptionDto;
  channel: ChannelDto;
  onClose: () => void;
  onPaid: () => void;
}

export default function GcashPanel({ sub, channel, onClose, onPaid }: Props) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paidRef, setPaidRef] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: sub.id,
          channelSlug: channel.slug,
        }),
      });
      const data = (await res.json()) as {
        ref?: string;
        gcash?: Intent;
        error?: string;
      };
      if (!alive) return;
      if (!res.ok || !data.ref || !data.gcash) {
        setError(data.error ?? "Could not create the payment QR.");
        return;
      }
      setRef(data.ref);
      setIntent(data.gcash);
    })();
    return () => {
      alive = false;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [sub.id, channel.slug]);

  const settle = useCallback(
    (transactionRef: string) => {
      setPaidRef(transactionRef);
      onPaid();
    },
    [onPaid]
  );

  const startPolling = useCallback(
    (transactionRef: string) => {
      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries += 1;
        const res = await fetch(`/api/payments/${transactionRef}`);
        if (res.ok) {
          const data = (await res.json()) as { status?: string };
          if (data.status === "PAID") {
            if (pollTimer.current) clearInterval(pollTimer.current);
            settle(transactionRef);
          }
        }
        if (tries > 100 && pollTimer.current) clearInterval(pollTimer.current);
      }, 3000);
    },
    [settle]
  );

  async function submitReference() {
    if (!ref || !manual.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${ref}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: manual.trim() }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit your reference.");
        return;
      }
      if (data.status === "PAID") {
        settle(ref);
      } else if (data.status === "PENDING_VERIFICATION") {
        startPolling(ref);
        setError(null);
        setManual("");
        alert(
          "Thank you! Your reference was received and is being verified. This page will update automatically."
        );
      } else {
        startPolling(ref);
      }
    } finally {
      setBusy(false);
    }
  }

  if (paidRef) {
    return (
      <div>
        <div className="success-box">
          Payment confirmed — thank you!
          <br />
          <small>Reference: {paidRef}</small>
        </div>
        <div className="row">
          <a className="btn" href={`/api/payments/${paidRef}/receipt`}>
            Download PDF receipt
          </a>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (error && !intent) {
    return (
      <div>
        <div className="error-box">{error}</div>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  if (!intent || !ref) {
    return <p className="muted">Generating your {channel.label} QR…</p>;
  }

  return (
    <div>
      {intent.qrDataUrl && (
        <div className="qr-wrap">
          <img src={intent.qrDataUrl} alt={`${channel.label} QR code`} />
          <div className="muted" style={{ fontSize: 12 }}>
            Amount: {formatPesoClient(sub.amountCents)} · Ref: {ref}
          </div>
        </div>
      )}
      {intent.checkoutUrl && (
        <p style={{ textAlign: "center" }}>
          <a className="btn" href={intent.checkoutUrl} target="_blank" rel="noreferrer">
            Open {channel.label} checkout
          </a>
        </p>
      )}
      <ol className="instructions">
        {intent.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {intent.manualReference && (
        <label className="field">
          <span>{channel.label} reference number (from your receipt)</span>
          <input
            className="input"
            value={manual}
            placeholder="e.g. 8021435567"
            onChange={(e) => setManual(e.target.value)}
          />
        </label>
      )}
      {error && <div className="error-box">{error}</div>}
      {intent.manualReference ? (
        <button
          className="btn primary"
          style={{ width: "100%" }}
          disabled={busy || !manual.trim()}
          onClick={submitReference}
        >
          {busy ? "Submitting…" : intent.autoConfirm ? "I have paid — confirm" : "Submit for verification"}
        </button>
      ) : (
        <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>
          This page updates automatically once {intent.provider === "STATIC_QR" ? channel.label : intent.provider} confirms your payment.
        </p>
      )}
    </div>
  );
}
