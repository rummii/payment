import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSessionToken, hashSecret, setSessionCookie } from "@/lib/auth";
import { validateSignupInput } from "@/lib/signupValidation";
import { SubStatus } from "@/lib/constants";
import { endOfMonth } from "@/lib/dates";
import { dispatchEmail } from "@/notifications/dispatch";
import { buildSignupWelcomeEmail } from "@/notifications/templates";

/**
 * POST /api/auth/signup — public client self-registration.
 *
 * Creates a Client with a password (isAdmin is never settable here), emails a
 * welcome note, signs the new client in (session cookie), and optionally
 * auto-subscribes them to the free-tier plan configured via
 * SIGNUP_FREE_PLAN_SLUG (only free plans are auto-subscribed).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const check = validateSignupInput(body ?? {});
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }
  const { name, email, password } = check.value;

  const exists = await db.client.findUnique({ where: { email } });
  if (exists) {
    return Response.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashSecret(password);

  let client;
  try {
    client = await db.client.create({
      data: {
        name,
        email,
        passwordHash,
        isAdmin: false, // self-signup can never grant admin
      },
    });
  } catch (e) {
    // Unique-constraint race (concurrent signups with the same email).
    if ((e as { code?: string })?.code === "P2002") {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }
    throw e;
  }

  // Optional: auto-subscribe to the configured free-tier plan.
  let planName: string | undefined;
  const freeSlug = env.signupFreePlanSlug;
  if (freeSlug) {
    const plan = await db.plan.findUnique({ where: { slug: freeSlug } });
    if (plan && plan.isActive && plan.isFree) {
      const now = new Date();
      await db.clientSubscription.create({
        data: {
          clientId: client.id,
          planId: plan.id,
          amountCents: plan.defaultAmountCents,
          currency: plan.currency,
          status: SubStatus.ACTIVE,
          billingCycle: plan.billingCycle,
          cycleStart: now,
          billingCycleEnd: endOfMonth(now),
        },
      });
      planName = plan.name;
    }
  }

  const content = buildSignupWelcomeEmail({ clientName: client.name, planName });
  await dispatchEmail({
    clientId: client.id,
    to: client.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  // Sign the new client in immediately.
  const token = await createSessionToken(client.id, client.email);
  await setSessionCookie(token);

  return Response.json(
    { ok: true, client: { id: client.id, email: client.email, name: client.name } },
    { status: 201 }
  );
}