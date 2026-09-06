import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { parseMeta } from "@/lib/paymentsService";

/**
 * GET /api/admin/verifications — the manual-review queue for GCash/e-wallet
 * payments whose reference numbers were submitted (STATIC_QR mode without
 * auto-confirm).
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const payments = await db.payment.findMany({
    where: { status: { in: ["PENDING_VERIFICATION", "PENDING"] } },
    include: {
      client: true,
      subscription: { include: { plan: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return Response.json({
    verifications: payments.map((p) => ({
      id: p.id,
      ref: p.transactionRef,
      clientName: p.client.name,
      clientEmail: p.client.email,
      planName: p.subscription.plan.name,
      amountCents: p.amountCents,
      method: p.method,
      provider: p.provider,
      status: p.status,
      reference: parseMeta(p.meta).reference ?? null,
      submittedAt: p.updatedAt,
    })),
  });
}
