import { redirect } from "next/navigation";
import { getSessionClient } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const client = await getSessionClient();
  if (client) redirect("/");
  return <LoginForm />;
}
