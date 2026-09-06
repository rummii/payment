import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * GET /api/dev/outbox — dev-only viewer for emails/SMS spooled by the
 * "log" providers (ENABLE_DEV_TOOLS=true or development mode).
 */
export async function GET() {
  if (!env.devTools) {
    return Response.json({ error: "Dev tools disabled" }, { status: 403 });
  }
  const messages = await db.outboxMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({ messages });
}
