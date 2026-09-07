// Optional in-process scheduler for self-hosted deployments
// (ENABLE_IN_SERVER_CRON=true). Serverless deploys use vercel.json instead.

import { env } from "@/lib/env";

const started = { value: false };

export function startInServerCron(): void {
  if (started.value || !env.inServerCron) return;
  started.value = true;

      void (async () => {
    // Use a dynamic module name (eval('import')) so that webpack/Next.js doesn't
    // try to bundle these modules at compile time. They depend on Node built-ins
    // (path, child_process, node:crypto) that are unavailable in the browser
    // bundling context. These are only ever needed at runtime when
    // ENABLE_IN_SERVER_CRON=true.
    const dyn = eval('import') as (s: string) => Promise<any>;
    const cronMod = await dyn("node-cron");
    const cron = cronMod.default;
    const { runDailyJob } = await dyn("@/engine/dailyJob");

    // Spec: daily 09:00 AM (PHT) reminder sweep.
    cron.schedule(
      "0 9 * * *",
      () => {
        console.log("[cron] 09:00 PHT daily job starting");
        runDailyJob()
          .then((s: any) => console.log("[cron] daily job summary:", JSON.stringify(s)))
          .catch((e: any) => console.error("[cron] daily job failed:", e));
      },
      { timezone: "Asia/Manila" }
    );

    // Outbound webhook retry queue every 10 minutes.
    cron.schedule(
      "*/10 * * * *",
      () => {
        void (async () => {
          const { retryDueDeliveries } = await dyn("@/engine/webhooks");
          const n = await retryDueDeliveries();
          if (n > 0) console.log(`[cron] retried ${n} webhook deliveries`);
        })().catch((e: any) => console.error("[cron] webhook retry failed:", e));
      },
      { timezone: "Asia/Manila" }
    );

    console.log("[cron] in-server scheduler started (09:00 PHT daily + webhook retries)");
  })();
}
