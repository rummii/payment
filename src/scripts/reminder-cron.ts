// One-shot reminder run: `npm run remind`
// Same logic the 09:00 cron endpoint executes.

import { runDailyJob } from "../engine/dailyJob";

runDailyJob()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Reminder run failed:", err);
    process.exit(1);
  });
