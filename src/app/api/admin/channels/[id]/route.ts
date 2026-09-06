import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/channels/:id — toggle, reorder, relabel, or edit the
 * non-secret config (e.g. static QR pay-to number/name).
 * Body: { isActive?, sortOrder?, label?, channelType?, config? }
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    isActive?: boolean;
    sortOrder?: number;
    label?: string;
    channelType?: string;
    config?: Record<string, unknown> | null;
  } | null;

  const data: Record<string, unknown> = {};
  if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body?.sortOrder !== undefined) data.sortOrder = Math.round(body.sortOrder);
  if (body?.label !== undefined) data.label = String(body.label).trim();
  if (body?.channelType !== undefined) data.channelType = String(body.channelType);
  if (body?.config !== undefined) {
    data.config = body.config ? JSON.stringify(body.config) : null;
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const channel = await db.paymentChannel.update({ where: { id }, data });
  return Response.json({ channel });
}

/** DELETE /api/admin/channels/:id — remove a custom channel row. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  await db.paymentChannel.delete({ where: { id } });
  return Response.json({ deleted: true });
}
