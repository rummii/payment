// Low-level email provider adapters (Resend | SendGrid). Dev "log" provider
// never reaches here — dispatch.ts short-circuits it into the outbox.

import { env } from "../lib/env";

function parseFromAddress(): string {
  const m = /<([^>]+)>/.exec(env.email.from);
  return m ? m[1] : env.email.from;
}

export async function sendEmailViaProvider(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  switch (env.email.provider) {
    case "resend": {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.email.from,
          to: [args.to],
          subject: args.subject,
          html: args.html,
        }),
      });
      if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
      return;
    }
    case "sendgrid": {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: args.to }] }],
          from: { email: parseFromAddress() },
          subject: args.subject,
          content: [
            { type: "text/plain", value: args.text },
            { type: "text/html", value: args.html },
          ],
        }),
      });
      if (!res.ok) throw new Error(`SendGrid error ${res.status}: ${await res.text()}`);
      return;
    }
    default:
      throw new Error(`Unknown email provider: ${env.email.provider}`);
  }
}
