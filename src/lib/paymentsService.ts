// Money-path service: payment creation, settlement (markPaid) and the
// calendar-aligned cycle advancement that flips a subscription to PAID.

import { db } from "./db";
import { addMonthsClamped, endOfMonth, startOfMonth } from "./dates";
import { formatPeso } from "./currency";
import {
  BillingCycle,
  Events,
  PayMethod,
  PayProvider,
  PayStatus,
  PayStatusValue,
  SubStatus,
} from "./constants";
import { randomToken } from "./hash";
import { publishEvent } from "../engine/webhooks";
import { getPayPalOrderStatus } from "../payments/paypal";
import { sendPaymentReceiptEmail } from "../notifications/templates";

export function newTransactionRef(prefix: "GC" | "PAY"): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `${prefix}-${stamp}-${randomToken(3).toUpperCase()}`;
}

export function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Next [cycleStart, billingCycleEnd] window after a settled cycle. */
export function nextCycleWindow(sub: {
  billingCycleEnd: Date;
  billingCycle: string;
}): { cycleStart: Date; billingCycleEnd: Date } {
  const months = sub.billingCycle === BillingCycle.ANNUAL ? 12 : 1;
  const cycleStart = addMonthsClamped(startOfMonth(sub.billingCycleEnd), months);
  return { cycleStart, billingCycleEnd: endOfMonth(cycleStart) };
}

export async function createPaymentRecord(args: {
  clientId: string;
  subscriptionId: string;
  amountCents: number;
  method: (typeof PayMethod)[keyof typeof PayMethod];
  provider: (typeof PayProvider)[keyof typeof PayProvider];
  externalId?: string;
  meta?: Record<string, unknown>;
}) {
  return db.payment.create({
    data: {
      clientId: args.clientId,
      subscriptionId: args.subscriptionId,
      amountCents: args.amountCents,
      method: args.method,
      provider: args.provider,
      transactionRef: newTransactionRef(
        args.method === PayMethod.PAYPAL ? "PAY" : "GC"
      ),
      externalId: args.externalId ?? null,
      status: PayStatus.PENDING,
      meta: args.meta ? JSON.stringify(args.meta) : null,
    },
  });
}

/**
 * Settle a payment: flip it to PAID, advance the subscription into the next
 * calendar cycle (status PAID), publish webhooks and email the receipt.
 * Idempotent — a second call for an already-PAID payment is a no-op.
 */
export async function markPaymentPaid(
  paymentId: string,
  extraMeta?: Record<string, unknown>
): Promise<{ paymentId: string; alreadyPaid: boolean }> {
  const existing = await db.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new Error(`Payment ${paymentId} not found`);
  if (existing.status === PayStatus.PAID) {
    return { paymentId, alreadyPaid: true };
  }

  const settledAt = new Date();
  const payment = await db.payment.update({
    where: { id: paymentId },
    data: {
      status: PayStatus.PAID,
      paymentDate: settledAt,
      meta: JSON.stringify({
        ...parseMeta(existing.meta),
        ...(extraMeta ?? {}),
        settledAt: settledAt.toISOString(),
      }),
    },
  });

  const sub = await db.clientSubscription.findUnique({
    where: { id: payment.subscriptionId },
    include: { plan: true },
  });

  if (sub && !sub.plan.isFree && sub.status !== SubStatus.CANCELLED) {
    const window = nextCycleWindow(sub);
    await db.clientSubscription.update({
      where: { id: sub.id },
      data: {
        status: SubStatus.PAID,
        cycleStart: window.cycleStart,
        billingCycleEnd: window.billingCycleEnd,
      },
    });
    await publishEvent(Events.SUBSCRIPTION_RENEWED, {
      subscriptionId: sub.id,
      planSlug: sub.plan.slug,
      nextCycleStart: window.cycleStart.toISOString(),
      nextCycleEnd: window.billingCycleEnd.toISOString(),
    });
  }

  await publishEvent(Events.PAYMENT_SUCCEEDED, {
    paymentRef: payment.transactionRef,
    subscriptionId: payment.subscriptionId,
    amountCents: payment.amountCents,
    method: payment.method,
    provider: payment.provider,
  });

  const client = await db.client.findUnique({
    where: { id: payment.clientId },
  });
  if (client && sub) {
    await sendPaymentReceiptEmail({
      to: client.email,
      clientName: client.name,
      planName: sub.plan.name,
      amountCents: payment.amountCents,
      reference: payment.transactionRef,
      method: payment.method,
      paymentDate: settledAt,
    });
  }

  return { paymentId, alreadyPaid: false };
}

export async function markPaymentFailed(
  paymentId: string,
  reason?: string
): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === PayStatus.PAID) return;
  await db.payment.update({
    where: { id: paymentId },
    data: { status: PayStatus.FAILED },
  });
  await publishEvent(Events.PAYMENT_FAILED, {
    paymentRef: payment.transactionRef,
    subscriptionId: payment.subscriptionId,
    amountCents: payment.amountCents,
    reason: reason ?? "unknown",
  });
}

/** Persist a freshly computed display status back onto the cached column. */
export async function syncPersistedStatus(
  subscriptionId: string,
  displayStatus: string
): Promise<void> {
  const map: Record<string, string> = {
    TRIAL: SubStatus.TRIAL,
    PAID: SubStatus.PAID,
    DUE: SubStatus.DUE,
    OVERDUE: SubStatus.OVERDUE,
    FREE_ACTIVE: SubStatus.ACTIVE,
    CANCELLED: SubStatus.CANCELLED,
  };
  const next = map[displayStatus];
  if (!next) return;
  const sub = await db.clientSubscription.findUnique({
    where: { id: subscriptionId },
    select: { status: true },
  });
  if (!sub || sub.status === next) return;
  await db.clientSubscription.update({
    where: { id: subscriptionId },
    data: { status: next },
  });
}

export function describeAmount(cents: number): string {
  return formatPeso(cents);
}

/**
 * Reconcile a PayPal payment's persisted status against PayPal's Orders v2
 * `GET /v2/checkout/orders/{id}` API. Safe to call repeatedly (idempotent):
 *
 *  - If PayPal reports COMPLETED and the local row is not yet PAID, the
 *    canonical `markPaymentPaid` path runs so the subscription cycle,
 *    webhooks and receipt all fire consistently.
 *  - Non-PAID transitions (FAILED / REFUNDED / PENDING_*) are written to the
 *    status column directly.
 *  - An already-matching status is a no-op.
 *
 * Throws when PayPal is unreachable or unconfigured -- callers should treat
 * that as "fall back to the persisted status."
 */
export async function refreshPayPalPaymentStatus(
  paymentId: string
): Promise<{ ref: string; status: string; changed: boolean }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  if (payment.provider !== PayProvider.PAYPAL || !payment.externalId) {
    throw new Error(`Payment ${payment.transactionRef} is not a PayPal payment`);
  }

  const info = await getPayPalOrderStatus(payment.externalId);
  const prev = payment.status as string;

  // Already in sync -- nothing to write.
  if (info.payStatus === prev) {
    return { ref: payment.transactionRef, status: prev, changed: false };
  }

  // Promotion to PAID flows through the canonical settle path.
  if (info.payStatus === PayStatus.PAID) {
    const { alreadyPaid } = await markPaymentPaid(payment.id, {
      captureId: info.captureId,
      verifiedBy: "paypal-poll",
      paypalOrderStatus: info.orderStatus,
      paypalCaptureStatus: info.captureStatus,
    });
    return {
      ref: payment.transactionRef,
      status: PayStatus.PAID,
      changed: !alreadyPaid,
    };
  }

  // Non-PAID transitions (FAILED / REFUNDED / PENDING_*).
  await db.payment.update({
    where: { id: paymentId },
    data: { status: info.payStatus },
  });
  return {
    ref: payment.transactionRef,
    status: info.payStatus,
    changed: true,
  };
}
