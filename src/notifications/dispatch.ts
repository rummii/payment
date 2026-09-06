// Notification dispatcher — every outbound message is persisted to the
// OutboxMessage table first (audit trail + dev viewer), then delivered via
// the configured provider. Delivery failures are recorded, never thrown.

import { db } from "../lib/db";
import { env } from "../lib/env";
import { OutboxChannel, OutboxStatus } from "../lib/constants";
import { sendEmailViaProvider } from "./email";
import { sendSmsViaProvider } from "./sms";

export interface DispatchEmailArgs {
  clientId?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function dispatchEmail(args: DispatchEmailArgs): Promise<void> {
  const record = await db.outboxMessage.create({
    data: {
      clientId: args.clientId ?? null,
      channel: OutboxChannel.EMAIL,
      recipient: args.to,
      subject: args.subject,
      body: args.html,
      provider: env.email.provider,
    },
  });
  console.log(`[email:${env.email.provider}] → ${args.to} :: ${args.subject}`);
  if (env.email.provider === "log") {
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.SENT, sentAt: new Date() },
    });
    return;
  }
  try {
    await sendEmailViaProvider(args);
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.SENT, sentAt: new Date() },
    });
  } catch (err) {
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.FAILED, error: String(err) },
    });
  }
}

export async function dispatchSms(args: {
  clientId?: string | null;
  to: string;
  message: string;
}): Promise<void> {
  const record = await db.outboxMessage.create({
    data: {
      clientId: args.clientId ?? null,
      channel: OutboxChannel.SMS,
      recipient: args.to,
      subject: null,
      body: args.message,
      provider: env.sms.provider,
    },
  });
  console.log(`[sms:${env.sms.provider}] → ${args.to} :: ${args.message.slice(0, 60)}`);
  if (env.sms.provider === "log") {
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.SENT, sentAt: new Date() },
    });
    return;
  }
  try {
    await sendSmsViaProvider(args);
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.SENT, sentAt: new Date() },
    });
  } catch (err) {
    await db.outboxMessage.update({
      where: { id: record.id },
      data: { status: OutboxStatus.FAILED, error: String(err) },
    });
  }
}
