import { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildReceiptPdf } from "@/lib/receipt";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ref: string }> }
) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { ref } = await ctx.params;

  const payment = await db.payment.findUnique({
    where: { transactionRef: ref },
    include: { subscription: { include: { plan: true } } },
  });
  if (!payment || payment.clientId !== client.id) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  const pdf = await buildReceiptPdf({
    transactionRef: payment.transactionRef,
    clientName: client.name,
    clientEmail: client.email,
    planName: payment.subscription.plan.name,
    amountCents: payment.amountCents,
    method: payment.method,
    provider: payment.provider,
    status: payment.status,
    paymentDate: payment.paymentDate,
  });

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.transactionRef}.pdf"`,
    },
  });
}
