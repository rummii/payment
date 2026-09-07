"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box card">
        <div className="brand">
          OSIRIS CENTER <span>Billing</span>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              required
              value={email}
              placeholder="you@company.ph"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>PIN / Password</span>
            <input
              className="input"
              type="password"
              required
              value={pin}
              placeholder="••••••"
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="hint">
          Demo access: demo@client.ph · PIN 123456
          <br />
          Magic links from your platform open the dashboard pre-authenticated.
        </div>
      </div>
    </div>
  );
}
