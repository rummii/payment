import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";

/** PATCH — toggle/update; DELETE — remove an endpoint. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    events?: string;
    isActive?: boolean;
  };
  const data: Record<string, unknown> = {};
  if (body.url !== undefined) data.url = String(body.url).trim();
  if (body.events !== undefined) data.events = String(body.events).trim() || "*";
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const endpoint = await db.webhookEndpoint.update({ where: { id }, data });
  return Response.json({
    endpoint: { id: endpoint.id, url: endpoint.url, events: endpoint.events, isActive: endpoint.isActive },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  await db.webhookEndpoint.delete({ where: { id } });
  return Response.json({ deleted: true });
}
