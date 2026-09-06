import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  provisioningErrorResponse,
  requireProvisioningKey,
} from "@/lib/provisioning";
import { hashSecret, randomToken } from "@/lib/hash";
import { dispatchEmail } from "@/notifications/dispatch";
import { buildWelcomeEmail, portalLink } from "@/notifications/templates";

/**
 * POST /api/provisioning/clients — upsert a client (your platform's signup).
 * Body: { name, email, phone?, pin? } → generates a PIN when omitted.
 */
export async function POST(req: NextRequest) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    phone?: string;
    pin?: string;
  } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();
  if (!email || !name) {
    return Response.json({ error: "name and email are required" }, { status: 400 });
  }

  const existing = await db.client.findUnique({ where: { email } });
  if (existing) {
    const updated = await db.client.update({
      where: { id: existing.id },
      data: {
        name,
        phone: body?.phone ?? existing.phone,
      },
    });
    return Response.json({ client: { id: updated.id, email: updated.email, name: updated.name }, created: false });
  }

  const generatedPin = body?.pin ? null : String(Math.floor(100000 + Math.random() * 900000));
  const plainPin = body?.pin ?? generatedPin ?? undefined;
  const client = await db.client.create({
    data: {
      name,
      email,
      phone: body?.phone ?? null,
      pinHash: plainPin ? await hashSecret(plainPin) : null,
    },
  });

  await dispatchEmail({
    clientId: client.id,
    to: client.email,
    subject: "Your billing portal account is ready",
    html: `Welcome ${client.name}! Sign in at ${portalLink("/login")}${generatedPin ? ` with PIN <strong>${generatedPin}</strong>` : ""}.`,
    text: `Welcome ${client.name}! Sign in at ${portalLink("/login")}${generatedPin ? ` with PIN ${generatedPin}` : ""}.`,
  });

  return Response.json({
    client: { id: client.id, email: client.email, name: client.name },
    created: true,
    ...(generatedPin ? { generatedPin } : {}),
  });
}

// keep randomToken referenced for potential future key endpoints
void randomToken;
