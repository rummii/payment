import { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PayMethod, PayProvider, PayStatus } from "@/lib/constants";
import { markPaymentPaid, parseMeta } from "@/lib/paymentsService";
import { getGcashGateway } from "@/payments/gateway";

/**
 * GCash settlement confirmation.
 *  - STATIC_QR: payer submits the GCash reference number → PAID (dev
 *    auto-confirm) or PENDING_VERIFICATION (ops review).
 *  - XENDIT / PAYMONGO: best-effort status poll; webhooks remain authoritative.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ ref: string }> }
) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { ref } = await ctx.params;

  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment || payment.clientId !== client.id) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status === PayStatus.PAID) {
    return Response.json({ ref, status: PayStatus.PAID, paymentDate: payment.paymentDate });
  }
  if (payment.provider === PayProvider.PAYPAL) {
    return Response.json({ error: "Use the PayPal capture flow" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { reference?: string };
  const reference = String(body.reference ?? "").trim();

  const gateway = getGcashGateway();

  // Real providers: try an authoritative poll first.
  if (
    (payment.provider === PayProvider.XENDIT || payment.provider === PayProvider.PAYMONGO) &&
    gateway.verify
  ) {
    try {
      const result = await gateway.verify({
        externalId: payment.externalId,
        transactionRef: payment.transactionRef,
      });
      if (result.paid) {
        const settled = await markPaymentPaid(payment.id, {
          reference,
          verifiedBy: "provider-poll",
        });
        return Response.json({ ref, status: PayStatus.PAID, alreadyPaid: settled.alreadyPaid });
      }
    } catch {
      // fall through to pending handling
    }
    return Response.json({ ref, status: payment.status }, { status: 202 });
  }

  // STATIC_QR manual reference flow.
  if (!reference) {
    return Response.json({ error: "GCash reference number is required" }, { status: 400 });
  }
  if (payment.provider === PayProvider.STATIC_QR && env.gcash.autoConfirmStaticQr) {
    await markPaymentPaid(payment.id, { reference, verifiedBy: "manual-auto-confirm" });
    const fresh = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return Response.json({ ref, status: fresh.status, paymentDate: fresh.paymentDate });
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: PayStatus.PENDING_VERIFICATION,
      meta: JSON.stringify({ ...parseMeta(payment.meta), reference }),
    },
  });
  return Response.json({ ref, status: PayStatus.PENDING_VERIFICATION });
}
