// SMS provider adapter (Semaphore — PH-friendly bulk SMS).

import { env } from "../lib/env";

export async function sendSmsViaProvider(args: {
  to: string;
  message: string;
}): Promise<void> {
  switch (env.sms.provider) {
    case "semaphore": {
      const res = await fetch("https://api.semaphore.co/api/v4/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: env.sms.semaphoreApiKey,
          number: args.to.replace(/\s+/g, ""),
          message: args.message,
          sendername: env.sms.semaphoreSender,
        }),
      });
      if (!res.ok) throw new Error(`Semaphore error ${res.status}: ${await res.text()}`);
      return;
    }
    default:
      throw new Error(`Unknown SMS provider: ${env.sms.provider}`);
  }
}
