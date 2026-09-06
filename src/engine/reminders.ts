// Generalized reminder engine — evaluates every active subscription against
// the rule set, dedupes via ReminderLog (ruleKey + periodKey + client), then
// dispatches branded notifications via reminderSenders.

import { db } from "../lib/db";
import { computeDisplayState, type DisplayState } from "../lib/status";
import { periodKey } from "../lib/dates";
import { ReminderRules } from "../lib/constants";
import { overdueAction, renewalAction, trialReminderAction } from "./pure";
import { sendRuleNotification } from "./reminderSenders";

export interface RuleMatch {
  ruleKey: string;
  subscriptionId: string;
}

export interface ReminderRunSummary {
  evaluated: number;
  sent: RuleMatch[];
}

function evaluateRules(
  sub: { id: string; trialEndsAt: Date | null },
  state: DisplayState
): RuleMatch[] {
  const out: RuleMatch[] = [];

  if (state.status === "TRIAL") {
    const action = trialReminderAction(state.daysUntilTrialEnd);
    if (action) out.push({ ruleKey: action, subscriptionId: sub.id });
  }

  if (state.status === "DUE" || state.status === "OVERDUE") {
    const action = renewalAction(state.daysUntilEnd);
    if (action) out.push({ ruleKey: action, subscriptionId: sub.id });
  }

  if (state.status === "OVERDUE") {
    const action = overdueAction(Math.abs(state.daysUntilEnd));
    if (action === "FOLLOWUP") {
      out.push({ ruleKey: ReminderRules.OVERDUE_FOLLOWUP, subscriptionId: sub.id });
    } else if (action === "SUSPENSION") {
      out.push({ ruleKey: ReminderRules.SUSPENSION_WARNING, subscriptionId: sub.id });
    }
  }

  return out;
}

async function alreadySent(
  clientId: string,
  match: RuleMatch,
  key: string
): Promise<boolean> {
  const existing = await db.reminderLog.findUnique({
    where: {
      ruleKey_periodKey_clientId_subscriptionId: {
        ruleKey: match.ruleKey,
        periodKey: key,
        clientId,
        subscriptionId: match.subscriptionId,
      },
    },
  });
  return existing !== null;
}

export async function runReminders(
  now: Date = new Date()
): Promise<ReminderRunSummary> {
  const clients = await db.client.findMany({
    include: { subscriptions: { include: { plan: true, payments: true } } },
  });

  const key = periodKey(now);
  const sent: RuleMatch[] = [];
  let evaluated = 0;

  for (const client of clients) {
    const unpaidItems = client.subscriptions
      .filter((s) => !s.plan.isFree)
      .map((s) => ({
        sub: s,
        state: computeDisplayState(s, s.plan, s.payments, now),
      }))
      .filter(
        ({ state }) => state.status === "DUE" || state.status === "OVERDUE"
      )
      .map(({ sub }) => ({ planName: sub.plan.name, amountCents: sub.amountCents }));

    for (const sub of client.subscriptions) {
      evaluated += 1;
      const state = computeDisplayState(sub, sub.plan, sub.payments, now);
      const matches = evaluateRules(sub, state);

      for (const match of matches) {
        if (await alreadySent(client.id, match, key)) continue;

        await sendRuleNotification(match.ruleKey, {
          client: {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
          },
          sub: {
            id: sub.id,
            planName: sub.plan.name,
            amountCents: sub.amountCents,
            trialEndsAt: sub.trialEndsAt,
            billingCycleEnd: sub.billingCycleEnd,
          },
          state,
          unpaidItems,
        });

        await db.reminderLog.create({
          data: {
            clientId: client.id,
            subscriptionId: match.subscriptionId,
            ruleKey: match.ruleKey,
            periodKey: key,
            channel: "EMAIL",
          },
        });
        sent.push(match);
      }
    }
  }

  return { evaluated, sent };
}
