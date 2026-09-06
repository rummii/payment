"use client";

// PayPal panel — creates a server-side order, then renders the official
// PayPal JS SDK buttons; on approval the server captures the funds.

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPesoClient, type SubscriptionDto } from "@/lib/apiTypes";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        render: (target: HTMLElement) => Promise<void>;
      };
    };
  }
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
const CURRENCY = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? "PHP";

interface Props {
  sub: SubscriptionDto;
  onClose: () => void;
  onPaid: () => void;
}

export default function PaypalPanel({ sub, onClose, onPaid }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "paid">("loading");
  const buttonsHost = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const capture = useCallback(
    async (ref: string) => {
      const res = await fetch("/api/payments/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref }),
      });
      if (res.ok) {
        setStatus("paid");
        onPaid();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Capture failed — please try again.");
      }
    },
    [onPaid]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let alive = true;

    (async () => {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, method: "PAYPAL" }),
      });
      const data = (await res.json()) as {
        ref?: string;
        paypal?: { orderId: string };
        error?: string;
      };
      if (!alive) return;
      if (!res.ok || !data.ref || !data.paypal) {
        setStatus("ready");
        setError(data.error ?? "Could not create the PayPal order.");
        return;
      }
      const { ref, paypal } = data;

      const renderButtons = () => {
        if (!alive || !buttonsHost.current || !window.paypal) return;
        window.paypal
          .Buttons({
            style: { layout: "vertical", color: "gold" },
            createOrder: () => paypal.orderId,
            onApprove: async () => {
              await capture(ref);
            },
            onError: () => setError("PayPal window error — please retry."),
          })
          .render(buttonsHost.current)
          .catch(() => setError("Could not render PayPal buttons."));
      };

      if (!PAYPAL_CLIENT_ID) {
        setStatus("ready");
        setError(
          "PayPal is not configured on this deployment. Set NEXT_PUBLIC_PAYPAL_CLIENT_ID (browser) plus PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (server)."
        );
        return;
      }
      if (window.paypal) {
        setStatus("ready");
        renderButtons();
        return;
      }
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        PAYPAL_CLIENT_ID
      )}&currency=${encodeURIComponent(CURRENCY)}`;
      script.async = true;
      script.onload = () => {
        setStatus("ready");
        renderButtons();
      };
      script.onerror = () => setError("Failed to load the PayPal SDK.");
      document.body.appendChild(script);
    })();

    return () => {
      alive = false;
    };
  }, [sub.id, capture]);

  if (status === "paid") {
    return (
      <div>
        <div className="success-box">Payment completed via PayPal — thank you!</div>
        <button className="btn" style={{ width: "100%" }} onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13 }}>
        Pay {formatPesoClient(sub.amountCents)} securely with your PayPal balance,
        linked bank account, or credit/debit card.
      </p>
      {error && <div className="error-box">{error}</div>}
      <div ref={buttonsHost} />
      {status === "loading" && !error && (
        <p className="muted">Preparing PayPal checkout…</p>
      )}
    </div>
  );
}
