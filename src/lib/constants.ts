// Enumerated value unions — SQLite has no native enums, these are the
// single source of truth for the String columns in the Prisma schema.

export const SubStatus = {
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  PAID: "PAID",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;
export type SubStatusValue = (typeof SubStatus)[keyof typeof SubStatus];

export const PayMethod = {
  GCASH_QR: "GCASH_QR",
  MAYA: "MAYA",
  GRABPAY: "GRABPAY",
  SHOPEEPAY: "SHOPEEPAY",
  QR_PH: "QR_PH",
  PAYPAL: "PAYPAL",
} as const;
export type PayMethodValue = (typeof PayMethod)[keyof typeof PayMethod];

/** Human labels for payment methods (shared by UI + history). */
export const METHOD_LABELS: Record<string, string> = {
  GCASH_QR: "GCash QR",
  MAYA: "Maya",
  GRABPAY: "GrabPay",
  SHOPEEPAY: "ShopeePay",
  QR_PH: "QR Ph",
  PAYPAL: "PayPal",
};

export const PayStatus = {
  PENDING: "PENDING",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PayStatusValue = (typeof PayStatus)[keyof typeof PayStatus];

export const PayProvider = {
  STATIC_QR: "STATIC_QR",
  XENDIT: "XENDIT",
  PAYMONGO: "PAYMONGO",
  PAYPAL: "PAYPAL",
} as const;
export type PayProviderValue = (typeof PayProvider)[keyof typeof PayProvider];

export const BillingCycle = {
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
} as const;
export type BillingCycleValue =
  (typeof BillingCycle)[keyof typeof BillingCycle];

export const PlanTier = {
  FREE: "FREE",
  STARTER: "STARTER",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;
export type PlanTierValue = (typeof PlanTier)[keyof typeof PlanTier];

export const OutboxChannel = { EMAIL: "EMAIL", SMS: "SMS" } as const;
export const OutboxStatus = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;

export const WebhookDeliveryStatus = {
  PENDING: "PENDING",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;

/** Outbound events published to platform webhook endpoints. */
export const Events = {
  SUBSCRIPTION_CREATED: "subscription.created",
  TRIAL_STARTED: "trial.started",
  TRIAL_EXPIRING: "trial.expiring",
  TRIAL_EXPIRED: "trial.expired",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_OVERDUE: "subscription.overdue",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
} as const;
export type EventValue = (typeof Events)[keyof typeof Events];

/** Reminder engine rule keys (deduped via ReminderLog). */
export const ReminderRules = {
  TRIAL_EXPIRING_3: "TRIAL_EXPIRING_3",
  TRIAL_EXPIRING_1: "TRIAL_EXPIRING_1",
  TRIAL_EXPIRED: "TRIAL_EXPIRED",
  RENEWAL_10: "RENEWAL_10",
  RENEWAL_3: "RENEWAL_3",
  OVERDUE_FOLLOWUP: "OVERDUE_FOLLOWUP",
  SUSPENSION_WARNING: "SUSPENSION_WARNING",
} as const;
export type ReminderRuleValue =
  (typeof ReminderRules)[keyof typeof ReminderRules];
