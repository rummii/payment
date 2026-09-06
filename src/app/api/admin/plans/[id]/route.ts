import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { BillingCycle, SubStatus } from "@/lib/constants";

/** PATCH /api/admin/plans/:id — edit any plan field. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string | null;
    tier?: string;
    defaultAmountCents?: number;
    billingCycle?: string;
    trialDays?: number;
    isFree?: boolean;
    isActive?: boolean;
  } | null;

  const data: Record<string, unknown> = {};
  if (body?.name !== undefined) data.name = String(body.name).trim();
  if (body?.description !== undefined) {
    data.description = body.description ? String(body.description) : null;
  }
  if (body?.tier !== undefined) data.tier = body.tier;
  if (body?.defaultAmountCents !== undefined) {
    data.defaultAmountCents = Math.max(0, Math.round(body.defaultAmountCents));
  }
  if (body?.billingCycle !== undefined) {
    data.billingCycle =
      body.billingCycle === BillingCycle.ANNUAL
        ? BillingCycle.ANNUAL
        : BillingCycle.MONTHLY;
  }
  if (body?.trialDays !== undefined) {
    data.trialDays = Math.max(0, Math.round(body.trialDays));
  }
  if (body?.isFree !== undefined) data.isFree = Boolean(body.isFree);
  if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const plan = await db.plan.update({ where: { id }, data });
  return Response.json({ plan });
}

/** DELETE /api/admin/plans/:id — deactivate (subscriptions are preserved). */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const plan = await db.plan.update({
    where: { id },
    data: { isActive: false },
  });
  void SubStatus;
  return Response.json({ plan, deactivated: true });
}
