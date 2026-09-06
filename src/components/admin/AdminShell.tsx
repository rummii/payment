"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/channels", label: "Payment channels" },
  { href: "/admin/webhooks", label: "Webhooks" },
  { href: "/admin/outbox", label: "Outbox" },
];

export default function AdminShell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell" style={{ maxWidth: 1180 }}>
      <div className="topbar">
        <div>
          <div className="brand">
            Rummii <span>Admin</span>
          </div>
          <div className="userline">{name}</div>
        </div>
        <div className="row">
          <Link className="btn small" href="/">
            Client portal
          </Link>
          <button className="btn small" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`tab${pathname === item.href ? " active" : ""}`}
            style={{ flex: "0 0 auto", textDecoration: "none", display: "inline-block" }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
