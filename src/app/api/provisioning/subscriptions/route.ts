import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  provisioningErrorResponse,
  requireProvisioningKey,
} from "@/lib/provisioning";
import { endOfMonth, plusDays } from "@/lib/dates";
import { BillingCycle, Events, SubStatus } from "@/lib/constants";
import { publishEvent } from "@/engine/webhooks";
import { dispatchEmail } from "@/notifications/dispatch";
import { buildWelcomeEmail } from "@/notifications/templates";

/**
 * POST /api/provisioning/subscriptions
 * Body: { email, planSlug, trialDays?, amountOverrideCents?, billingCycle? }
 * Creates a ClientSubscription aligned to the PH calendar-month cycle.
 */
export async function POST(req: NextRequest) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    planSlug?: string;
    trialDays?: number;
    amountOverrideCents?: number;
    billingCycle?: string;
  } | null;
  if (!body?.email || !body?.planSlug) {
    return Response.json({ error: "email and planSlug are required" }, { status: 400 });
  }

  const client = await db.client.findUnique({
    where: { email: body.email.trim().toLowerCase() },
  });
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const plan = await db.plan.findUnique({ where: { slug: body.planSlug } });
  if (!plan || !plan.isActive) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const trialDays = Math.max(0, body.trialDays ?? plan.trialDays);
  const now = new Date();

  // Idempotency guard: if the client already holds a live subscription for
  // this plan, return it instead of creating a duplicate (safe retries).
  const existingSub = await db.clientSubscription.findFirst({
    where: {
      clientId: client.id,
      planId: plan.id,
      status: { not: SubStatus.CANCELLED },
    },
    include: { plan: true },
  });
  if (existingSub) {
    return Response.json({
      subscription: {
        id: existingSub.id,
        status: existingSub.status,
        amountCents: existingSub.amountCents,
        billingCycle: existingSub.billingCycle,
        cycleStart: existingSub.cycleStart,
        billingCycleEnd: existingSub.billingCycleEnd,
        trialEndsAt: existingSub.trialEndsAt,
        plan: { slug: plan.slug, name: plan.name, isFree: plan.isFree },
      },
      created: false,
    });
  }

  const trialEndsAt = trialDays > 0 ? plusDays(now, trialDays) : null;
  const billingCycle =
    body.billingCycle === BillingCycle.ANNUAL ? BillingCycle.ANNUAL : plan.billingCycle;
  const status = plan.isFree
    ? SubStatus.ACTIVE
    : trialEndsAt
      ? SubStatus.TRIAL
      : SubStatus.DUE;
  // Trial holders start billing from the month their trial ends.
  const cycleStart = trialEndsAt ?? now;
  const billingCycleEnd = endOfMonth(trialEndsAt ?? now);

  const subscription = await db.clientSubscription.create({
    data: {
      clientId: client.id,
      planId: plan.id,
      amountCents: body.amountOverrideCents ?? plan.defaultAmountCents,
      currency: plan.currency,
      status,
      billingCycle,
      cycleStart,
      billingCycleEnd,
      trialEndsAt,
    },
  });

  await publishEvent(Events.SUBSCRIPTION_CREATED, {
    subscriptionId: subscription.id,
    clientId: client.id,
    planSlug: plan.slug,
    status,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
  });
  if (trialEndsAt) {
    await publishEvent(Events.TRIAL_STARTED, {
      subscriptionId: subscription.id,
      planSlug: plan.slug,
      trialEndsAt: trialEndsAt.toISOString(),
      trialDays,
    });
  }
  const welcome = buildWelcomeEmail({ clientName: client.name, planName: plan.name });
  await dispatchEmail({
    clientId: client.id,
    to: client.email,
    subject: welcome.subject,
    html: welcome.html,
    text: welcome.text,
  });

  return Response.json(
    {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        amountCents: subscription.amountCents,
        billingCycle: subscription.billingCycle,
        cycleStart: subscription.cycleStart,
        billingCycleEnd: subscription.billingCycleEnd,
        trialEndsAt: subscription.trialEndsAt,
        plan: { slug: plan.slug, name: plan.name, isFree: plan.isFree },
      },
      created: true,
    },
    { status: 201 }
  );
}

/**
 * GET /api/provisioning/subscriptions?email=… — subscription status lookup
 * so the platform can gate features on billing state.
 */
export async function GET(req: NextRequest) {
  const auth = await requireProvisioningKey(req);
  if (!auth.ok) return provisioningErrorResponse(auth);

  const email = new URL(req.url).searchParams.get("email");
  if (!email) return Response.json({ error: "email query param required" }, { status: 400 });

  const client = await db.client.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      subscriptions: { include: { plan: true, payments: { where: { status: "PAID" } } } },
    },
  });
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  return Response.json({
    client: { id: client.id, name: client.name, email: client.email },
    subscriptions: client.subscriptions.map((s) => ({
      id: s.id,
      planSlug: s.plan.slug,
      planName: s.plan.name,
      status: s.status,
      amountCents: s.amountCents,
      billingCycle: s.billingCycle,
      cycleStart: s.cycleStart,
      billingCycleEnd: s.billingCycleEnd,
      trialEndsAt: s.trialEndsAt,
    })),
  });
}
