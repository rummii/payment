import { redirect } from "next/navigation";
import { getSessionClient } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = await getSessionClient();
  if (!client) redirect("/login");
  if (!client.isAdmin) redirect("/");
  return <AdminShell name={`${client.name} · ${client.email}`}>{children}</AdminShell>;
}
