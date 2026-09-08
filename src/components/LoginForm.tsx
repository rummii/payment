"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const isSignup = mode === "signup";
      const res = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { name, email, password } : { email, pin: password }
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ?? (isSignup ? "Signup failed" : "Login failed")
        );
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

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="login-wrap">
      <div className="login-box card">
        <div className="brand">
          OSIRIS CENTER <span>Billing</span>
        </div>
        <div className="tabs" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`tab${mode === "signin" ? " active" : ""}`}
            style={{ flex: "1 1 0", padding: "8px 12px" }}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`tab${mode === "signup" ? " active" : ""}`}
            style={{ flex: "1 1 0", padding: "8px 12px" }}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                type="text"
                required
                value={name}
                placeholder="Your name or company"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
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
            <span>
              {mode === "signup" ? "Password (min 8 characters)" : "PIN / Password"}
            </span>
            <input
              className="input"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              placeholder="••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
            {busy
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
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
