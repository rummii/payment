import { redirect } from "next/navigation";
import { getSessionClient } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const client = await getSessionClient();
  if (!client) redirect("/login");
  return <Dashboard />;
}
