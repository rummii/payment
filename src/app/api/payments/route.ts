import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await db.payment.findMany({
    where: { clientId: client.id },
    include: { subscription: { include: { plan: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json({
    payments: payments.map((p) => ({
      id: p.id,
      transactionRef: p.transactionRef,
      planName: p.subscription.plan.name,
      method: p.method,
      provider: p.provider,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
      receiptAvailable: p.status === "PAID",
    })),
  });
}
