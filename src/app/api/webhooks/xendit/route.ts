import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/hash";
import { PayStatus } from "@/lib/constants";
import { markPaymentPaid, parseMeta } from "@/lib/paymentsService";

/**
 * Xendit callback listener. Validates the x-callback-token header against
 * XENDIT_CALLBACK_TOKEN and reconciles QR payments (v3 `payment.succeeded`
 * and legacy v2 QR payload shapes).
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-callback-token") ?? "";
  if (!env.xendit.callbackToken || !safeEqual(token, env.xendit.callbackToken)) {
    return Response.json({ error: "Invalid callback token" }, { status: 401 });
  }

  const body = JSON.parse(await req.text().catch(() => "{}")) as {
    event?: string;
    status?: string;
    data?: { reference_id?: string; status?: string; id?: string };
    reference_id?: string;
    external_id?: string;
    id?: string;
  };

  const ref =
    body.data?.reference_id ?? body.reference_id ?? body.external_id ?? null;
  const status = body.data?.status ?? body.status ?? "";
  const paid =
    status === "SUCCEEDED" || status === "PAID" || status === "COMPLETED";

  if (!ref) return Response.json({ received: true, ignored: "no reference" });

  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment) return Response.json({ received: true, ignored: "unknown reference" });
  if (payment.status === PayStatus.PAID) {
    return Response.json({ received: true, alreadyPaid: true });
  }
  if (!paid) {
    await db.payment.update({
      where: { id: payment.id },
      data: { meta: JSON.stringify({ ...parseMeta(payment.meta), lastWebhook: body.event ?? status }) },
    });
    return Response.json({ received: true, status: payment.status });
  }

  const { alreadyPaid } = await markPaymentPaid(payment.id, {
    verifiedBy: "xendit-webhook",
    providerEventId: body.data?.id ?? body.id ?? null,
  });
  return Response.json({ received: true, alreadyPaid });
}
