// Shared API DTOs for the client SPA.

export interface ClientDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
}

export type DisplayStatusDto =
  | "TRIAL"
  | "PAID"
  | "DUE"
  | "OVERDUE"
  | "FREE_ACTIVE"
  | "CANCELLED";

export interface SubscriptionDto {
  id: string;
  plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tier: string;
    isFree: boolean;
  };
  amountCents: number;
  currency: string;
  billingCycle: string;
  cycleStart: string;
  billingCycleEnd: string;
  trialEndsAt: string | null;
  status: DisplayStatusDto;
  paidThisCycle: boolean;
  daysUntilEnd: number;
  daysUntilTrialEnd: number | null;
}

export interface PaymentDto {
  id: string;
  transactionRef: string;
  planName: string;
  method: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  paymentDate: string | null;
  createdAt: string;
  receiptAvailable: boolean;
}

export function formatPesoClient(cents: number): string {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateClient(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
