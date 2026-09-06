import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  provisioningErrorResponse,
  requireProvisioningKey,
} from "@/lib/provisioning";
import { issueMagicLink } from "@/lib/auth";
import { dispatchEmail } from "@/notifications/dispatch";

/**
 * POST /api/provisioning/magic-links — SSO handoff for your platform:
 * Body { email } → one-time, 15-min pre-auth URL (also emailed).
 */
export async function POST(req: NextRequest) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return Response.json({ error: "email is required" }, { status: 400 });

  const client = await db.client.findUnique({ where: { email } });
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const token = await issueMagicLink(client.id);
  const url = `${env.appUrl}/api/auth/magic/${token}`;

  await dispatchEmail({
    clientId: client.id,
    to: client.email,
    subject: "Your billing portal sign-in link",
    html: `<p>Hi ${client.name}, use the link below to open your billing portal (valid 15 minutes, single use).</p><p><a href="${url}">${url}</a></p>`,
    text: `Sign in: ${url} (valid 15 minutes, single use)`,
  });

  return Response.json({ url, expiresInMinutes: 15 });
}
