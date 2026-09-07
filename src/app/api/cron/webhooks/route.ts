import type { NextRequest } from "next/server";
import { checkCronSecret } from "@/lib/provisioning";
import { retryDueDeliveries } from "@/engine/webhooks";

/**
 * Webhook retry endpoint for Cloud Scheduler.
 * Runs every 10 minutes to retry failed webhook deliveries.
 * Guarded by CRON_SECRET (header `x-cron-secret` or ?secret=).
 */
export async function GET(req: NextRequest) {
  if (!checkCronSecret(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const retried = await retryDueDeliveries();
  return Response.json({ retried });
}