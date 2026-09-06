import { requireAdmin } from "@/lib/adminAuth";
import { db } from "@/lib/db";

/** GET /api/admin/outbox — full email/SMS spool (all providers). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const messages = await db.outboxMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json({ messages });
}
