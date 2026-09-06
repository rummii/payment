import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("query")?.trim().toLowerCase() ?? "";
  const payments = await db.payment.findMany({
    where: q
      ? {
          OR: [
            { transactionRef: { contains: q } },
            { client: { name: { contains: q } } },
            { client: { email: { contains: q } } },
          ],
        }
      : undefined,
    include: { client: true, subscription: { include: { plan: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return Response.json({
    payments: payments.map((p) => ({
      id: p.id,
      ref: p.transactionRef,
      clientName: p.client.name,
      clientEmail: p.client.email,
      planName: p.subscription.plan.name,
      method: p.method,
      provider: p.provider,
      amountCents: p.amountCents,
      status: p.status,
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
    })),
  });
}
