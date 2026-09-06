import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";
import { attemptDelivery, retryDueDeliveries } from "@/engine/webhooks";

/** GET — recent deliveries. POST { deliveryId? } — retry one or all due. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const deliveries = await db.webhookDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({ deliveries });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { deliveryId?: string };
  if (body.deliveryId) {
    await attemptDelivery(body.deliveryId);
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: body.deliveryId },
    });
    return Response.json({ delivery });
  }
  const retried = await retryDueDeliveries();
  return Response.json({ retried });
}
