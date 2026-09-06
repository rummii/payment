import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { PayStatus } from "@/lib/constants";
import { markPaymentFailed, markPaymentPaid, parseMeta } from "@/lib/paymentsService";

/**
 * POST /api/admin/verifications/:id  { action: "approve" | "reject", reference?, reason? }
 * Approve settles the payment via markPaymentPaid (advances the billing cycle
 * and fires webhooks/receipt); reject marks it FAILED with the reason.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    reference?: string;
    reason?: string;
  };

  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status === PayStatus.PAID) {
    return Response.json({ error: "Payment is already settled" }, { status: 409 });
  }

  if (body.action === "approve") {
    const reference =
      String(body.reference ?? "").trim() ||
      String(parseMeta(payment.meta).reference ?? "");
    if (!reference) {
      return Response.json(
        { error: "A GCash/e-wallet reference number is required to approve" },
        { status: 400 }
      );
    }
    const { alreadyPaid } = await markPaymentPaid(payment.id, {
      reference,
      verifiedBy: "admin",
      adminEmail: admin.email,
    });
    return Response.json({ status: PayStatus.PAID, alreadyPaid });
  }

  if (body.action === "reject") {
    await markPaymentFailed(payment.id, body.reason ?? "Rejected by admin");
    return Response.json({ status: PayStatus.FAILED });
  }

  return Response.json({ error: "action must be approve or reject" }, { status: 400 });
}
