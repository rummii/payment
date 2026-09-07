import type { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, paypalConfigured } from "@/lib/env";
import { PayMethod, PayProvider, PayStatus } from "@/lib/constants";
import { newTransactionRef } from "@/lib/paymentsService";
import { computeDisplayState } from "@/lib/status";
import {
  ensureDefaultChannels,
  getActiveChannels,
  getChannelBySlug,
} from "@/payments/channels";
import { gatewayForProvider } from "@/payments/gateway";
import { createPayPalOrder } from "@/payments/paypal";
import { endOfMonth } from "@/lib/dates";

/**
 * Creates a payment intent for a subscription against a DB-driven channel.
 * Accepts { channelSlug } (preferred) or legacy { method } (maps to the first
 * active channel of that method).
 */
export async function POST(req: NextRequest) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    subscriptionId?: string;
    channelSlug?: string;
    method?: string;
  } | null;
  if (!body?.subscriptionId || (!body?.channelSlug && !body?.method)) {
    return Response.json(
      { error: "subscriptionId and channelSlug (or legacy method) are required" },
      { status: 400 }
    );
  }

  const sub = await db.clientSubscription.findUnique({
    where: { id: body.subscriptionId },
    include: { plan: true, payments: true },
  });
  if (!sub || sub.clientId !== client.id) {
    return Response.json({ error: "Subscription not found" }, { status: 404 });
  }
  if (sub.plan.isFree) {
    return Response.json({ error: "Free-tier subscriptions are not billed" }, { status: 400 });
  }
  if (sub.status === "CANCELLED") {
    return Response.json({ error: "Subscription is cancelled" }, { status: 400 });
  }
  const state = computeDisplayState(sub, sub.plan, sub.payments);
  if (state.status === "PAID") {
    return Response.json({ error: "This cycle is already paid" }, { status: 409 });
  }

  // ── Resolve the payment channel ──────────────────────────────────────────
  await ensureDefaultChannels();
  let channel = null;
  if (body.channelSlug) {
    channel = await getChannelBySlug(body.channelSlug);
    if (!channel) {
      return Response.json({ error: "Payment channel not found" }, { status: 404 });
    }
    if (!channel.isActive) {
      return Response.json({ error: "Payment channel is disabled" }, { status: 400 });
    }
  } else {
    channel =
      (await getActiveChannels()).find(
        (c) => c.method === body.method && c.credentialReady
      ) ?? null;
  }
  if (!channel) {
    return Response.json({ error: "No active payment channel for that method" }, { status: 400 });
  }
  if (!channel.credentialReady) {
    return Response.json(
      { error: `Channel "${channel.label}" is missing provider credentials` },
      { status: 503 }
    );
  }

  const ref = newTransactionRef(channel.method === PayMethod.PAYPAL ? "PAY" : "GC");
  const description = `${sub.plan.name} — cycle ending ${endOfMonth(sub.billingCycleEnd).toISOString().slice(0, 10)}`;
  const channelMeta = { channelSlug: channel.slug, description };

  if (channel.provider === PayProvider.PAYPAL) {
    if (!paypalConfigured()) {
      return Response.json(
        {
          error:
            "PayPal is not configured. Set PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (server) and NEXT_PUBLIC_PAYPAL_CLIENT_ID (browser SDK).",
        },
        { status: 503 }
      );
    }
    try {
      const order = await createPayPalOrder({
        amountCents: sub.amountCents,
        ref,
        description,
        channelConfig: channel.config,
      });
      await db.payment.create({
        data: {
          clientId: client.id,
          subscriptionId: sub.id,
          amountCents: sub.amountCents,
          method: channel.method,
          provider: PayProvider.PAYPAL,
          transactionRef: ref,
          externalId: order.orderId,
          status: PayStatus.PENDING,
          meta: JSON.stringify({ ...channelMeta, approveUrl: order.approveUrl }),
        },
      });
      return Response.json({
        ref,
        method: channel.method,
        amountCents: sub.amountCents,
        channel: {
          slug: channel.slug,
          label: channel.label,
          provider: channel.provider,
        },
        paypal: { orderId: order.orderId },
      });
    } catch (err) {
      return Response.json({ error: `PayPal error: ${String(err)}` }, { status: 502 });
    }
  }

  // QR / e-wallet family (STATIC_QR | XENDIT | PAYMONGO)
  const gateway = gatewayForProvider(channel.provider);
  try {
    const intent = await gateway.createIntent({
      amountCents: sub.amountCents,
      ref,
      description,
      channel: {
        method: channel.method,
        channelType: channel.channelType,
        config: channel.config,
      },
    });
    await db.payment.create({
      data: {
        clientId: client.id,
        subscriptionId: sub.id,
        amountCents: sub.amountCents,
        method: channel.method,
        provider: intent.provider,
        transactionRef: ref,
        externalId: intent.externalId ?? null,
        status: PayStatus.PENDING,
        meta: JSON.stringify(channelMeta),
      },
    });
    return Response.json({
      ref,
      method: channel.method,
      amountCents: sub.amountCents,
      channel: {
        slug: channel.slug,
        label: channel.label,
        provider: channel.provider,
      },
      gcash: {
        provider: intent.provider,
        qrDataUrl: intent.qrDataUrl ?? null,
        qrString: intent.qrString ?? null,
        checkoutUrl: intent.checkoutUrl ?? null,
        instructions: intent.instructions,
        autoConfirm: intent.autoConfirm,
        manualReference: intent.provider === PayProvider.STATIC_QR,
      },
    });
  } catch (err) {
    return Response.json(
      { error: `Payment gateway error: ${String(err)}` },
      { status: 502 }
    );
  }
}

// env imported to keep the module tree-shaken only where used (lint aid).
void env;
