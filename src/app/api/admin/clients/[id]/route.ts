import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { hashSecret, randomToken } from "@/lib/hash";

/**
 * PATCH /api/admin/clients/:id
 * Body: { name?, phone?, isAdmin?, action?: "reset-pin" }
 * reset-pin generates a fresh PIN and returns it exactly once.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string | null;
    isAdmin?: boolean;
    action?: string;
  };

  if (body.action === "reset-pin") {
    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    await db.client.update({
      where: { id },
      data: { pinHash: await hashSecret(newPin) },
    });
    return Response.json({ resetPin: newPin });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.isAdmin !== undefined) data.isAdmin = Boolean(body.isAdmin);
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const client = await db.client.update({ where: { id }, data });
  return Response.json({
    client: { id: client.id, name: client.name, email: client.email, isAdmin: client.isAdmin },
  });
}

// randomToken referenced for future invite-link support
void randomToken;
