import type { NextRequest } from "next/server";
import { checkCronSecret } from "@/lib/provisioning";
import { runDailyJob } from "@/engine/dailyJob";

/**
 * Daily automated task (spec: 09:00 PHT — vercel.json fires 01:00 UTC):
 *  1. Lifecycle sweeps (trial expiry, overdue marking)
 *  2. Reminder rules (T-10 renewal per spec, trial T-3/T-1, overdue follow-ups)
 *  3. Outbound webhook retries
 * Guarded by CRON_SECRET (header `x-cron-secret` or ?secret=).
 */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const summary = await runDailyJob();
  return Response.json(summary);
}
