// Central environment accessor — every module reads config from here so the
// same defaults apply to route handlers, scripts, and tests.

function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

export const env = {
  appUrl: str("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  authSecret: str(
    "AUTH_SECRET",
    "dev-only-secret-0123456789abcdef0123456789abcdef"
  ),
  cronSecret: str("CRON_SECRET", "dev-cron-secret"),

  gcash: {
    provider: str("GCASH_PROVIDER", "static"), // static | xendit | paymongo
    staticNumber: str("GCASH_STATIC_NUMBER", "09171234567"),
    staticName: str("GCASH_STATIC_NAME", "OSIRIS CENTER Digital Services"),
    autoConfirmStaticQr: str("AUTO_CONFIRM_STATIC_QR", "false") === "true",
  },

  xendit: {
    apiKey: str("XENDIT_API_KEY"),
    callbackToken: str("XENDIT_CALLBACK_TOKEN"),
    apiBase: str("XENDIT_API_BASE", "https://api.xendit.co"),
  },

  paymongo: {
    secretKey: str("PAYMONGO_SECRET_KEY"),
    webhookSecret: str("PAYMONGO_WEBHOOK_SECRET"),
  },

  paypal: {
    mode: str("PAYPAL_ENV", "sandbox"), // sandbox | live
    clientId: str("PAYPAL_CLIENT_ID"),
    clientSecret: str("PAYPAL_CLIENT_SECRET"),
    webhookId: str("PAYPAL_WEBHOOK_ID"),
    currency: str("PAYPAL_CURRENCY", "PHP"),
  },

  email: {
    provider: str("EMAIL_PROVIDER", "log"), // log | resend | sendgrid
    from: str("EMAIL_FROM", "Billing <billing@localhost>"),
    resendApiKey: str("RESEND_API_KEY"),
    sendgridApiKey: str("SENDGRID_API_KEY"),
  },

  sms: {
    provider: str("SMS_PROVIDER", "log"), // log | semaphore
    semaphoreApiKey: str("SEMAPHORE_API_KEY"),
    semaphoreSender: str("SEMAPHORE_SENDER_NAME", "OSIRIS CENTER"),
  },

  devTools:
    str("ENABLE_DEV_TOOLS", "false") === "true" ||
    process.env.NODE_ENV === "development",

  inServerCron: str("ENABLE_IN_SERVER_CRON", "false") === "true",
};

export function paypalConfigured(): boolean {
  return Boolean(env.paypal.clientId && env.paypal.clientSecret);
}

export function gcashProviderName(): string {
  const p = env.gcash.provider;
  if (p === "xendit" && !env.xendit.apiKey) return "static";
  if (p === "paymongo" && !env.paymongo.secretKey) return "static";
  return p;
}
