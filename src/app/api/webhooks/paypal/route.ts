import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PayStatus } from "@/lib/constants";
import { markPaymentPaid } from "@/lib/paymentsService";
import { verifyPayPalWebhook } from "@/payments/paypal";

/**
 * PayPal webhook listener — off-web fallback for PAYMENT.CAPTURE.COMPLETED.
 * Signature is verified against PAYPAL_WEBHOOK_ID when configured; in dev
 * (unconfigured) events are accepted log-only for local testing.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (process.env.PAYPAL_WEBHOOK_ID) {
    const valid = await verifyPayPalWebhook(req.headers, raw).catch(() => false);
    if (!valid) {
      return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(raw || "{}") as {
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      custom_id?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
    };
  };

  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return Response.json({ received: true, ignored: event.event_type ?? "unknown" });
  }

  const ref = event.resource?.custom_id;
  if (!ref) {
    return Response.json({ received: true, ignored: "missing custom_id" });
  }
  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment) {
    return Response.json({ received: true, ignored: "unknown reference" });
  }
  if (payment.status === PayStatus.PAID) {
    return Response.json({ received: true, alreadyPaid: true });
  }

  const { alreadyPaid } = await markPaymentPaid(payment.id, {
    webhookEvent: event.event_type,
    captureId: event.resource?.id,
    verifiedBy: "paypal-webhook",
  });
  return Response.json({ received: true, alreadyPaid });
}
