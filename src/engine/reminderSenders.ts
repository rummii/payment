// Rule-based email/SMS dispatchers for the reminder engine.

import { Events, ReminderRules } from "../lib/constants";
import type { DisplayState } from "../lib/status";
import { portalLink } from "../notifications/templates";
import {
  buildOverdueEmail,
  buildRenewalReminderEmail,
  buildTrialEmail,
} from "../notifications/templates";
import { dispatchEmail, dispatchSms } from "../notifications/dispatch";
import { publishEvent } from "./webhooks";

export interface SenderContext {
  client: { id: string; name: string; email: string; phone: string | null };
  sub: {
    id: string;
    planName: string;
    amountCents: number;
    trialEndsAt: Date | null;
    billingCycleEnd: Date;
  };
  state: DisplayState;
  unpaidItems: Array<{ planName: string; amountCents: number }>;
}

export async function sendRuleNotification(
  ruleKey: string,
  ctx: SenderContext
): Promise<void> {
  const { client, sub, state } = ctx;

  if (
    ruleKey === ReminderRules.TRIAL_EXPIRING_3 ||
    ruleKey === ReminderRules.TRIAL_EXPIRING_1
  ) {
    const daysLeft = state.daysUntilTrialEnd ?? 0;
    const content = buildTrialEmail({
      clientName: client.name,
      planName: sub.planName,
      daysLeft,
      trialEndsAt: sub.trialEndsAt as Date,
    });
    await dispatchEmail({
      clientId: client.id,
      to: client.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (client.phone) {
      await dispatchSms({
        clientId: client.id,
        to: client.phone,
        message: `Rummii Billing: your ${sub.planName} trial ends in ${daysLeft} day(s). Pay at ${portalLink()}`,
      });
    }
    await publishEvent(Events.TRIAL_EXPIRING, {
      subscriptionId: sub.id,
      daysLeft,
    });
    return;
  }

  if (ruleKey === ReminderRules.RENEWAL_10 || ruleKey === ReminderRules.RENEWAL_3) {
    // Spec: itemized breakdown of all due plans + total in PHP.
    const items = ctx.unpaidItems;
    const total = items.reduce((sum, i) => sum + i.amountCents, 0);
    const content = buildRenewalReminderEmail({
      clientName: client.name,
      items,
      totalCents: total,
      dueDate: sub.billingCycleEnd,
    });
    await dispatchEmail({
      clientId: client.id,
      to: client.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    return;
  }

  if (
    ruleKey === ReminderRules.OVERDUE_FOLLOWUP ||
    ruleKey === ReminderRules.SUSPENSION_WARNING
  ) {
    const content = buildOverdueEmail({
      clientName: client.name,
      planName: sub.planName,
      amountCents: sub.amountCents,
      overdueDays: Math.abs(state.daysUntilEnd),
      final: ruleKey === ReminderRules.SUSPENSION_WARNING,
    });
    await dispatchEmail({
      clientId: client.id,
      to: client.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }
}
