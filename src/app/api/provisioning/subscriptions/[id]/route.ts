import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  provisioningErrorResponse,
  requireProvisioningKey,
} from "@/lib/provisioning";
import { Events, SubStatus } from "@/lib/constants";
import { publishEvent } from "@/engine/webhooks";

/**
 * PATCH /api/provisioning/subscriptions/:id — change plan amount, cycle,
 * or resume/cancel. DELETE = cancel.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);
  const { id } = await ctx.params;

  const sub = await db.clientSubscription.findUnique({ where: { id } });
  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    amountCents?: number;
    billingCycle?: string;
    status?: string;
  } | null;

  const data: Record<string, unknown> = {};
  if (typeof body?.amountCents === "number") data.amountCents = body.amountCents;
  if (body?.billingCycle === "MONTHLY" || body?.billingCycle === "ANNUAL") {
    data.billingCycle = body.billingCycle;
  }
  if (body?.status === SubStatus.ACTIVE) data.status = SubStatus.ACTIVE;
  if (body?.status === SubStatus.CANCELLED) data.status = SubStatus.CANCELLED;

  const updated = await db.clientSubscription.update({ where: { id }, data });

  if (data.status === SubStatus.CANCELLED && sub.status !== SubStatus.CANCELLED) {
    await publishEvent(Events.SUBSCRIPTION_CANCELLED, {
      subscriptionId: updated.id,
      planId: updated.planId,
    });
  }

  return Response.json({ subscription: updated });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);
  const { id } = await ctx.params;

  const sub = await db.clientSubscription.findUnique({ where: { id } });
  if (!sub) return Response.json({ error: "Subscription not found" }, { status: 404 });

  const updated = await db.clientSubscription.update({
    where: { id },
    data: { status: SubStatus.CANCELLED },
  });
  await publishEvent(Events.SUBSCRIPTION_CANCELLED, {
    subscriptionId: updated.id,
    planId: updated.planId,
  });
  return Response.json({ subscription: updated, cancelled: true });
}
