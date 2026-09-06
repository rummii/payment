import { getSessionClient } from "@/lib/auth";

export async function GET() {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      isAdmin: client.isAdmin,
    },
  });
}
