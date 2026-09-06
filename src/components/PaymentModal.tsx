"use client";

import { useEffect, useState } from "react";
import { formatPesoClient, type SubscriptionDto } from "@/lib/apiTypes";
import GcashPanel from "./GcashPanel";
import PaypalPanel from "./PaypalPanel";

interface ChannelDto {
  slug: string;
  label: string;
  method: string;
  provider: string;
  credentialReady: boolean;
}

interface Props {
  sub: SubscriptionDto;
  onClose: () => void;
  onPaid: () => void;
}

export default function PaymentModal({ sub, onClose, onPaid }: Props) {
  const [channels, setChannels] = useState<ChannelDto[] | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/channels");
      const data = (await res.json().catch(() => null)) as {
        channels?: ChannelDto[];
      } | null;
      if (!alive) return;
      const list = data?.channels ?? [];
      setChannels(list);
      if (list.length > 0) setActiveSlug(list[0].slug);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const active = channels?.find((c) => c.slug === activeSlug) ?? null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{sub.plan.name}</h3>
        <div className="sub">
          {formatPesoClient(sub.amountCents)} · cycle ending{" "}
          {new Date(sub.billingCycleEnd).toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        {channels === null ? (
          <p className="muted">Loading payment channels…</p>
        ) : channels.length === 0 ? (
          <div className="error-box">
            No payment channels are currently enabled. Please contact support.
          </div>
        ) : (
          <>
            <div className="tabs" style={{ flexWrap: "wrap" }}>
              {channels.map((c) => (
                <button
                  key={c.slug}
                  className={`tab${activeSlug === c.slug ? " active" : ""}`}
                  style={{ flex: "0 1 auto", padding: "8px 14px" }}
                  onClick={() => setActiveSlug(c.slug)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {active && active.provider === "PAYPAL" ? (
              <PaypalPanel sub={sub} onClose={onClose} onPaid={onPaid} />
            ) : active ? (
              <GcashPanel sub={sub} channel={active} onClose={onClose} onPaid={onPaid} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

