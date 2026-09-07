"use client";

// Field components for the channel settings modal.

import { PROVIDER_LABELS } from "@/lib/constants";

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

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function SectionHelp({ children }: { children: React.ReactNode }) {
  return (
    <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
      {children}
    </p>
  );
}

export function StaticQrFields({
  number,
  setNumber,
  name,
  setName,
  autoConfirm,
  setAutoConfirm,
}: {
  number: string;
  setNumber: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  autoConfirm: boolean;
  setAutoConfirm: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Pay-to number (e.g. 09171234567)">
          <input
            className="input"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="09171234567"
          />
        </Field>
        <Field label="Pay-to name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rummii Digital Services"
          />
        </Field>
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          marginTop: 8,
        }}
      >
        <input
          type="checkbox"
          checked={autoConfirm}
          onChange={(e) => setAutoConfirm(e.target.checked)}
        />
        Auto-confirm entered references (dev/test only)
      </label>
      <SectionHelp>
        These details are encoded in the QR and shown to clients. Leave blank to
        use environment defaults.
      </SectionHelp>
    </div>
  );
}

export function PayPalFields({
  brandName,
  setBrandName,
  currency,
  setCurrency,
  shippingPref,
  setShippingPref,
  userAction,
  setUserAction,
}: {
  brandName: string;
  setBrandName: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  shippingPref: string;
  setShippingPref: (v: string) => void;
  userAction: string;
  setUserAction: (v: string) => void;
}) {
  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Brand name (shown on PayPal checkout)">
          <input
            className="input"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </Field>
        <Field label="Currency">
          <select
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="PHP">PHP — Philippine Peso</option>
            <option value="USD">USD — US Dollar</option>
            <option value="SGD">SGD — Singapore Dollar</option>
          </select>
        </Field>
        <Field label="Shipping">
          <select
            className="input"
            value={shippingPref}
            onChange={(e) => setShippingPref(e.target.value)}
          >
            <option value="NO_SHIPPING">No shipping (digital)</option>
            <option value="SET_PROVIDED_ADDRESS">Use provided address</option>
            <option value="GET_FROM_FILE">Get from PayPal account</option>
          </select>
        </Field>
        <Field label="User action">
          <select
            className="input"
            value={userAction}
            onChange={(e) => setUserAction(e.target.value)}
          >
            <option value="PAY_NOW">Pay Now</option>
            <option value="CONTINUE">Continue</option>
          </select>
        </Field>
      </div>
      <SectionHelp>
        API credentials (client ID/secret) are configured in the server
        environment.
      </SectionHelp>
    </div>
  );
}

export function XenditFields({
  apiBase,
  setApiBase,
  expiresHrs,
  setExpiresHrs,
}: {
  apiBase: string;
  setApiBase: (v: string) => void;
  expiresHrs: string;
  setExpiresHrs: (v: string) => void;
}) {
  return (
    <div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Field label="API base URL">
          <input
            className="input"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
          />
        </Field>
        <Field label="QR expires after (hours)">
          <input
            className="input"
            type="number"
            min="1"
            value={expiresHrs}
            onChange={(e) => setExpiresHrs(e.target.value)}
          />
        </Field>
      </div>
      <SectionHelp>API key is configured in the server environment.</SectionHelp>
    </div>
  );
}

export function PaymongoFields({
  sourceType,
  setSourceType,
}: {
  sourceType: string;
  setSourceType: (v: string) => void;
}) {
  return (
    <div>
      <Field label="E-wallet source">
        <select
          className="input"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
        >
          <option value="gcash">GCash</option>
          <option value="grabpay">GrabPay</option>
          <option value="paymaya">Maya</option>
        </select>
      </Field>
      <SectionHelp>
        API secret is configured in the server environment.
      </SectionHelp>
    </div>
  );
}
