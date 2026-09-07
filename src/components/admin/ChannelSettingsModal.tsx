"use client";

// Provider-aware channel settings modal.

import { useState } from "react";
import {
  buildPaymongoConfig,
  buildStaticQrConfig,
  buildXenditConfig,
} from "@/payments/channelLogic";
import {
  PayPalFields,
  PaymongoFields,
  StaticQrFields,
  XenditFields,
  providerLabel,
} from "./channelFields";
import { Channel } from "./types";

interface Props {
  channel: Channel;
  onClose: () => void;
  onSave: (config: Record<string, unknown>, msg: string) => void;
}

export default function ChannelSettingsModal({
  channel,
  onClose,
  onSave,
}: Props) {
  const cfg = channel.config ?? {};

  const [number, setNumber] = useState<string>(
    ((cfg.payTo as Record<string, unknown>)?.number as string) ?? ""
  );
  const [name, setName] = useState<string>(
    ((cfg.payTo as Record<string, unknown>)?.name as string) ?? ""
  );
  const [autoConfirm, setAutoConfirm] = useState<boolean>(
    Boolean(cfg.autoConfirm)
  );
  const [brandName, setBrandName] = useState<string>(
    ((cfg.experienceContext as Record<string, unknown>)?.brandName as string) ??
      "Rummii"
  );
  const [currency, setCurrency] = useState<string>(
    (cfg.currency as string) ?? "PHP"
  );
  const [shippingPref, setShippingPref] = useState<string>(
    ((cfg.experienceContext as Record<string, unknown>)
      ?.shippingPreference as string) ?? "NO_SHIPPING"
  );
  const [userAction, setUserAction] = useState<string>(
    ((cfg.experienceContext as Record<string, unknown>)?.userAction as string) ??
      "PAY_NOW"
  );
  const [apiBase, setApiBase] = useState<string>(
    (cfg.apiBase as string) ?? "https://api.xendit.co"
  );
  const [expiresHrs, setExpiresHrs] = useState<string>(
    String(Math.round(((cfg.expiresIn as number) ?? 24 * 3600) / 3600))
  );
  const [sourceType, setSourceType] = useState<string>(
    (cfg.sourceType as string) ?? "gcash"
  );

  function handleSave() {
    let config: Record<string, unknown> = {};
    switch (channel.provider) {
      case "STATIC_QR":
        config = buildStaticQrConfig({
          number: number.trim() || undefined,
          name: name.trim() || undefined,
          autoConfirm,
        }) as unknown as Record<string, unknown>;
        break;
      case "PAYPAL":
        config = {
          experienceContext: {
            brandName: brandName.trim() || "Rummii",
            shippingPreference: shippingPref,
            userAction,
          },
          currency: currency.trim() || "PHP",
        };
        break;
      case "XENDIT":
        config = buildXenditConfig({
          apiBase: apiBase.trim() || undefined,
          expiresIn: Math.round(parseFloat(expiresHrs || "24") * 3600),
        }) as unknown as Record<string, unknown>;
        break;
      case "PAYMONGO":
        config = buildPaymongoConfig({
          sourceType: sourceType as "gcash" | "grabpay" | "paymaya",
        }) as unknown as Record<string, unknown>;
        break;
    }
    onSave(config, `${channel.label} settings saved.`);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{channel.label} settings</h3>
          <button className="btn small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sub">
          {providerLabel(channel.provider)} · {channel.method}
          {channel.channelType ? ` · ${channel.channelType}` : ""}
        </div>

        {channel.provider === "STATIC_QR" && (
          <StaticQrFields
            number={number}
            setNumber={setNumber}
            name={name}
            setName={setName}
            autoConfirm={autoConfirm}
            setAutoConfirm={setAutoConfirm}
          />
        )}
        {channel.provider === "PAYPAL" && (
          <PayPalFields
            brandName={brandName}
            setBrandName={setBrandName}
            currency={currency}
            setCurrency={setCurrency}
            shippingPref={shippingPref}
            setShippingPref={setShippingPref}
            userAction={userAction}
            setUserAction={setUserAction}
          />
        )}
        {channel.provider === "XENDIT" && (
          <XenditFields
            apiBase={apiBase}
            setApiBase={setApiBase}
            expiresHrs={expiresHrs}
            setExpiresHrs={setExpiresHrs}
          />
        )}
        {channel.provider === "PAYMONGO" && (
          <PaymongoFields sourceType={sourceType} setSourceType={setSourceType} />
        )}

        <div className="row mt16">
          <button className="btn primary" onClick={handleSave}>
            Save settings
          </button>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
