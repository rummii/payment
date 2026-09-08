import { NextRequest } from "next/server";
import { getSessionClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { PayProvider } from "@/lib/constants";
import { refreshPayPalPaymentStatus } from "@/lib/paymentsService";

/**
 * GET /api/payments/:ref — return a client's payment record.
 *
 * Pass `?refresh=true` to live-reconcile a PayPal payment against PayPal's
 * Orders v2 API (GET /v2/checkout/orders/{id}), syncing the persisted
 * `status` back to the ledger. Other providers and the default call return
 * the cached status. When PayPal is unreachable or unconfigured, the cached
 * status is returned unchanged and `refreshed` is false.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ref: string }> }
) {
  const client = await getSessionClient();
  if (!client) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { ref } = await ctx.params;

  const payment = await db.payment.findUnique({ where: { transactionRef: ref } });
  if (!payment || payment.clientId !== client.id) {
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }

  const refresh = req.nextUrl.searchParams.get("refresh");
  let refreshed = false;
  if (refresh === "true" && payment.provider === PayProvider.PAYPAL) {
    try {
      await refreshPayPalPaymentStatus(payment.id);
      refreshed = true;
    } catch (err) {
      // PayPal unreachable / not configured -- fall back to the persisted status.
      console.warn(`[paypal-status] ref=${ref} err=${String(err)}`);
    }
  }

  const fresh = refreshed
    ? await db.payment.findUniqueOrThrow({ where: { id: payment.id } })
    : payment;

  return Response.json({
    ref: fresh.transactionRef,
    status: fresh.status,
    method: fresh.method,
    provider: fresh.provider,
    amountCents: fresh.amountCents,
    paymentDate: fresh.paymentDate,
    refreshed,
  });
}
