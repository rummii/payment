import { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { PayProvider, PayStatus } from "@/lib/constants";
import { markPaymentPaid } from "@/lib/paymentsService";
import { capturePayPalOrder } from "@/payments/paypal";

/**
 * Primary PayPal settlement path: the browser approves the order with the
 * JS SDK, then the server captures the funds and reconciles the cycle.
 */
export async function POST(req: NextRequest) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ref?: string } | null;
  if (!body?.ref) {
    return Response.json({ error: "ref is required" }, { status: 400 });
  }
  const payment = await db.payment.findUnique({
    where: { transactionRef: body.ref },
  });
  if (!payment || payment.clientId !== client.id) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status === PayStatus.PAID) {
    return Response.json({ ref: payment.transactionRef, status: PayStatus.PAID });
  }
  if (payment.provider !== PayProvider.PAYPAL || !payment.externalId) {
    return Response.json({ error: "Not a PayPal payment" }, { status: 400 });
  }

  try {
    const capture = await capturePayPalOrder(payment.externalId);
    if (capture.status !== "COMPLETED") {
      return Response.json(
        { error: `Capture not completed (${capture.status})` },
        { status: 402 }
      );
    }
    const { alreadyPaid } = await markPaymentPaid(payment.id, {
      captureId: capture.captureId,
      verifiedBy: "server-capture",
    });
    return Response.json({
      ref: payment.transactionRef,
      status: PayStatus.PAID,
      alreadyPaid,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
