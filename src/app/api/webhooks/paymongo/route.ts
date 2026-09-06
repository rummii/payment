import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { PayProvider, PayStatus } from "@/lib/constants";
import { markPaymentPaid } from "@/lib/paymentsService";

/**
 * PayMongo webhook listener (`source.chargeable`). Verifies the
 * `paymongo-signature` header (t=…,te=… HMAC-SHA256 of `t.body`) when
 * PAYMONGO_WEBHOOK_SECRET is configured.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (env.paymongo.webhookSecret) {
    const header = req.headers.get("paymongo-signature") ?? "";
    const parts = Object.fromEntries(
      header.split(",").map((kv) => kv.trim().split("=") as [string, string])
    );
    const timestamp = parts["t"];
    const hash = parts["te"] ?? parts["li"];
    if (!timestamp || !hash) {
      return Response.json({ error: "Missing signature" }, { status: 401 });
    }
    const expected = createHmac("sha256", env.paymongo.webhookSecret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");
    if (expected !== hash) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = JSON.parse(raw || "{}") as {
    event?: string;
    data?: {
      id?: string;
      attributes?: {
        type?: string;
        metadata?: { ref?: string };
      };
    };
  };

  if (body.event !== "source.chargeable") {
    return Response.json({ received: true, ignored: body.event ?? "unknown" });
  }

  const sourceId = body.data?.id;
  const ref =
    body.data?.attributes?.metadata?.ref ??
    (sourceId
      ? (
          await db.payment.findFirst({ where: { externalId: sourceId } })
        )?.transactionRef
      : null);

  if (!ref) return Response.json({ received: true, ignored: "no reference" });

  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment) return Response.json({ received: true, ignored: "unknown reference" });
  if (payment.status === PayStatus.PAID) {
    return Response.json({ received: true, alreadyPaid: true });
  }
  if (payment.provider !== PayProvider.PAYMONGO && sourceId) {
    await db.payment.update({
      where: { id: payment.id },
      data: { externalId: sourceId },
    });
  }

  const { alreadyPaid } = await markPaymentPaid(payment.id, {
    verifiedBy: "paymongo-webhook",
    sourceId: sourceId ?? null,
  });
  return Response.json({ received: true, alreadyPaid });
}
