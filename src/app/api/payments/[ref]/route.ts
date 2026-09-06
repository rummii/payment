import { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ref: string }> }
) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { ref } = await ctx.params;

  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment || payment.clientId !== client.id) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  return Response.json({
    ref: payment.transactionRef,
    status: payment.status,
    method: payment.method,
    provider: payment.provider,
    amountCents: payment.amountCents,
    paymentDate: payment.paymentDate,
  });
}
