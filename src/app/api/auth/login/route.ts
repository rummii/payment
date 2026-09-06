import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie, verifySecret } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    pin?: string;
  } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const pin = String(body?.pin ?? "").trim();
  if (!email || !pin) {
    return Response.json({ error: "Email and PIN are required" }, { status: 400 });
  }
  const client = await db.client.findUnique({ where: { email } });
  if (!client) {
    return Response.json({ error: "Invalid email or PIN" }, { status: 401 });
  }
  const okPin = await verifySecret(pin, client.pinHash);
  const okPassword = okPin ? false : await verifySecret(pin, client.passwordHash);
  if (!okPin && !okPassword) {
    return Response.json({ error: "Invalid email or PIN" }, { status: 401 });
  }
  const token = await createSessionToken(client.id, client.email);
  await setSessionCookie(token);
  return Response.json({
    ok: true,
    client: { id: client.id, name: client.name, email: client.email },
  });
}
