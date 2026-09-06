import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { addMonthsClamped, endOfMonth, startOfMonth } from "@/lib/dates";
import { BillingCycle, Events, SubStatus } from "@/lib/constants";
import { publishEvent } from "@/engine/webhooks";
import { syncPersistedStatus } from "@/lib/paymentsService";

/**
 * PATCH /api/admin/subscriptions/:id
 * Body: { amountCents?, billingCycleEnd?, status?, extendCycles? }
 * - status: "CANCELLED" pauses/cancels; "ACTIVE" resumes; "DUE" re-opens billing
 * - extendCycles: number of cycles to credit without payment (comp cycles)
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const sub = await db.clientSubscription.findUnique({ where: { id } });
  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    amountCents?: number;
    billingCycleEnd?: string;
    status?: string;
    extendCycles?: number;
  } | null;

  const data: Record<string, unknown> = {};
  if (typeof body?.amountCents === "number") {
    data.amountCents = Math.max(0, Math.round(body.amountCents));
  }
  if (body?.billingCycleEnd) {
    const d = new Date(body.billingCycleEnd);
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "Invalid billingCycleEnd" }, { status: 400 });
    }
    data.billingCycleEnd = d;
  }
  if (body?.extendCycles && body.extendCycles > 0) {
    const months = (sub.billingCycle === BillingCycle.ANNUAL ? 12 : 1) * body.extendCycles;
    const newEnd = endOfMonth(addMonthsClamped(startOfMonth(sub.billingCycleEnd), months));
    data.billingCycleEnd = newEnd;
    data.status = SubStatus.PAID;
  }
  if (body?.status === SubStatus.CANCELLED || body?.status === SubStatus.ACTIVE || body?.status === SubStatus.DUE) {
    data.status = body.status;
  }

  const updated = await db.clientSubscription.update({ where: { id }, data });
  if (data.status === SubStatus.CANCELLED && sub.status !== SubStatus.CANCELLED) {
    await publishEvent(Events.SUBSCRIPTION_CANCELLED, {
      subscriptionId: updated.id,
      planId: updated.planId,
      by: admin.email,
    });
  }
  await syncPersistedStatus(updated.id, String(data.status ?? updated.status)).catch(() => {});

  return Response.json({ subscription: updated });
}
