import { getSessionClient } from "@/lib/auth";

export async function GET() {
  const client = await getSessionClient();
  if (!client) return Response.json({ authenticated: false });
  return Response.json({
    authenticated: true,
    client: { id: client.id, name: client.name, email: client.email, phone: client.phone },
  });
}
