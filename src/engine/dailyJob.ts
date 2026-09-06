// Daily orchestration used by the cron route, the standalone script and the
// optional in-server scheduler: lifecycle → reminders → webhook retries.

import { runLifecycle } from "./lifecycle";
import { runReminders } from "./reminders";
import { retryDueDeliveries } from "./webhooks";

export interface DailyJobSummary {
  ranAt: string;
  lifecycle: { trialsExpired: number; overdueMarked: number };
  reminders: {
    evaluated: number;
    sent: Array<{ ruleKey: string; subscriptionId: string }>;
  };
  webhookRetries: number;
}

export async function runDailyJob(now: Date = new Date()): Promise<DailyJobSummary> {
  const lifecycle = await runLifecycle(now);
  const reminders = await runReminders(now);
  const webhookRetries = await retryDueDeliveries();
  return {
    ranAt: now.toISOString(),
    lifecycle,
    reminders: {
      evaluated: reminders.evaluated,
      sent: reminders.sent,
    },
    webhookRetries,
  };
}
