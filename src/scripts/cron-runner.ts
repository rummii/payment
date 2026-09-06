// Long-running scheduler for self-hosted VMs: `npm run cron`
// (Serverless deploys should use vercel.json + /api/cron/daily instead.)

import { startInServerCron } from "../lib/cronScheduler";

startInServerCron();
console.log("Scheduler running — press Ctrl+C to stop.");

// Keep the event loop alive.
setInterval(() => {}, 60_000);
