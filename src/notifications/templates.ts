// Branded email templates for lifecycle + billing notifications.

import { env } from "../lib/env";
import { formatPeso } from "../lib/currency";
import { formatPhDateTime } from "../lib/dates";

export { sendPaymentReceiptEmail } from "./receipts";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function portalLink(path = "/"): string {
  return `${env.appUrl}${path}`;
}

export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0f19;font-family:Segoe UI,Arial,sans-serif;color:#e5e9f0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#121829;border:1px solid #232c44;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(90deg,#0ea5e9,#22c55e);padding:18px 24px;">
      <span style="font-size:18px;font-weight:700;color:#04121f;">OSIRIS CENTER Billing</span>
    </div>
    <div style="padding:28px 24px;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#f1f5f9;">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #232c44;font-size:12px;color:#8b94a7;">
      Automated message from your billing portal · ${env.appUrl}
    </div>
  </div></body></html>`;
}

export function itemRow(name: string, amount: string): string {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid #232c44;color:#cdd5e3;">${name}</td><td style="padding:8px 0;border-bottom:1px solid #232c44;text-align:right;font-weight:600;color:#f1f5f9;">${amount}</td></tr>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 4px;"><a href="${href}" style="background:#22c55e;color:#04121f;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">${label}</a></p>`;
}

export function buildRenewalReminderEmail(args: {
  clientName: string;
  items: Array<{ planName: string; amountCents: number }>;
  totalCents: number;
  dueDate: Date;
}): EmailContent {
  const rows = args.items
    .map((i) => itemRow(i.planName, formatPeso(i.amountCents)))
    .join("");
  const subject = "Action needed: your subscription renewal is due in 10 days";
  const text = `Hi ${args.clientName}, the following services renew on ${formatPhDateTime(args.dueDate)}:\n${args.items
    .map((i) => `- ${i.planName}: ${formatPeso(i.amountCents)}`)
    .join("\n")}\nTotal due: ${formatPeso(args.totalCents)}\nPay at ${portalLink()}`;
  const html = layout(
    `Your renewal is due on ${formatPhDateTime(args.dueDate)}`,
    `<p>Hi ${args.clientName}, here is your itemized breakdown for this billing cycle:</p>
     <table style="width:100%;border-collapse:collapse;">${rows}
     <tr><td style="padding:10px 0;font-weight:700;">Total due</td><td style="padding:10px 0;text-align:right;font-weight:700;color:#22c55e;">${formatPeso(args.totalCents)}</td></tr></table>
     ${button(portalLink(), "Pay now via GCash QR or PayPal")}`
  );
  return { subject, html, text };
}

export function buildTrialEmail(args: {
  clientName: string;
  planName: string;
  daysLeft: number;
  trialEndsAt: Date;
}): EmailContent {
  const subject = `Your ${args.planName} trial ends in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}`;
  const html = layout(
    subject,
    `<p>Hi ${args.clientName}, your free trial for <strong>${args.planName}</strong> ends on <strong>${formatPhDateTime(args.trialEndsAt)}</strong>.</p>
     <p>To keep your service running without interruption, settle the first billing cycle before the trial ends.</p>
     ${button(portalLink(), "Preview plan & payment options")}`
  );
  const text = `Hi ${args.clientName}, your ${args.planName} trial ends on ${formatPhDateTime(args.trialEndsAt)}. Settle at ${portalLink()} to continue.`;
  return { subject, html, text };
}

export function buildTrialExpiredEmail(args: {
  clientName: string;
  planName: string;
  amountCents: number;
}): EmailContent {
  const subject = `Your ${args.planName} trial has ended — settle to continue`;
  const html = layout(
    subject,
    `<p>Hi ${args.clientName}, the trial period for <strong>${args.planName}</strong> has ended.</p>
     <p>Amount due to activate this cycle: <strong>${formatPeso(args.amountCents)}</strong></p>
     ${button(portalLink(), "Pay now")}`
  );
  return { subject, html, text: `Your ${args.planName} trial ended. Pay ${formatPeso(args.amountCents)} at ${portalLink()}` };
}

export function buildOverdueEmail(args: {
  clientName: string;
  planName: string;
  amountCents: number;
  overdueDays: number;
  final: boolean;
}): EmailContent {
  const subject = args.final
    ? `FINAL NOTICE: ${args.planName} is ${args.overdueDays} days overdue`
    : `Reminder: ${args.planName} payment is ${args.overdueDays} days overdue`;
  const html = layout(
    subject,
    `<p>Hi ${args.clientName}, payment for <strong>${args.planName}</strong> is <strong style="color:#f87171;">${args.overdueDays} days overdue</strong>.</p>
     <p>Outstanding balance: <strong>${formatPeso(args.amountCents)}</strong></p>
     ${args.final ? "<p>Please settle immediately to avoid service suspension.</p>" : ""}
     ${button(portalLink(), "Settle now")}`
  );
  return { subject, html, text: `${args.planName} is ${args.overdueDays} days overdue (${formatPeso(args.amountCents)}). Pay at ${portalLink()}` };
}

export function buildWelcomeEmail(args: {
  clientName: string;
  planName: string;
}): EmailContent {
  const subject = `Welcome! Your ${args.planName} subscription is active`;
  const html = layout(
    `Welcome aboard, ${args.clientName}!`,
    `<p>Your <strong>${args.planName}</strong> subscription is now active. Review billing, pay via GCash QR or PayPal, and download receipts anytime.</p>
     ${button(portalLink(), "Open billing portal")}`
  );
  return { subject, html, text: `Your ${args.planName} subscription is active. Portal: ${portalLink()}` };
}
