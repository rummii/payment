/**
 * Seed data — demo client with one subscription in each lifecycle state:
 * PAID, DUE, OVERDUE, TRIAL, plus a FREE-tier plan.
 *
 * Login: demo@client.ph / PIN 123456
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { endOfMonth, minusDays, plusDays, startOfMonth } from "../src/lib/dates";
import {
  BillingCycle,
  PayMethod,
  PayProvider,
  PayStatus,
  PlanTier,
  SubStatus,
} from "../src/lib/constants";

const db = new PrismaClient();

async function main() {
  const now = new Date();
  const som = startOfMonth(now);
  const eom = endOfMonth(now);
  const prevMonthAnyDay = minusDays(som, 1); // a day inside the previous month
  const somPrev = startOfMonth(prevMonthAnyDay);
  const eomPrev = endOfMonth(prevMonthAnyDay);
  const somPrevPrev = startOfMonth(minusDays(somPrev, 1)); // two months back

  // ── Plans ────────────────────────────────────────────────────────────────
  const webInfra = await db.plan.upsert({
    where: { slug: "web-infra" },
    update: {},
    create: {
      slug: "web-infra",
      name: "Web & Email Infrastructure",
      description:
        "Managed hosting, domain, business email and SSL for your websites.",
      tier: PlanTier.STARTER,
      defaultAmountCents: 150_000,
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 0,
      isFree: false,
    },
  });

  const crmApp = await db.plan.upsert({
    where: { slug: "crm-app" },
    update: {},
    create: {
      slug: "crm-app",
      name: "CRM App",
      description:
        "Customer relationship management portal with lead tracking and reporting.",
      tier: PlanTier.PRO,
      defaultAmountCents: 250_000,
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 0,
      isFree: false,
    },
  });

  const inventory = await db.plan.upsert({
    where: { slug: "inventory-portal" },
    update: {},
    create: {
      slug: "inventory-portal",
      name: "Inventory Portal",
      description:
        "Stock control and fulfillment dashboard for your warehouse team.",
      tier: PlanTier.PRO,
      defaultAmountCents: 200_000,
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 0,
      isFree: false,
    },
  });

  const customErp = await db.plan.upsert({
    where: { slug: "custom-erp" },
    update: {},
    create: {
      slug: "custom-erp",
      name: "Custom ERP App",
      description:
        "Tailor-built ERP integration suite — billing, HR and procurement modules.",
      tier: PlanTier.ENTERPRISE,
      defaultAmountCents: 750_000,
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 14,
      isFree: false,
    },
  });

  const starterFree = await db.plan.upsert({
    where: { slug: "starter-free" },
    update: {},
    create: {
      slug: "starter-free",
      name: "Starter (Free Tier)",
      description: "Free starter workspace — community support, no billing.",
      tier: PlanTier.FREE,
      defaultAmountCents: 0,
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 0,
      isFree: true,
    },
  });

  // ── Demo client ──────────────────────────────────────────────────────────
  const pinHash = await bcrypt.hash("123456", 10);
  const client = await db.client.upsert({
    where: { email: "demo@client.ph" },
    update: { name: "Demo Client Corp", phone: "+63 917 123 4567", isAdmin: true },
    create: {
      name: "Demo Client Corp",
      email: "demo@client.ph",
      phone: "+63 917 123 4567",
      pinHash,
      isAdmin: true,
    },
  });

  // Idempotent reseed: clear this client's subscriptions & payments first.
  await db.payment.deleteMany({ where: { clientId: client.id } });
  await db.clientSubscription.deleteMany({ where: { clientId: client.id } });

  await seedSubscriptions({
    clientId: client.id,
    now,
    som,
    eom,
    somPrev,
    eomPrev,
    somPrevPrev,
    webInfraId: webInfra.id,
    webInfraAmount: webInfra.defaultAmountCents,
    crmId: crmApp.id,
    crmAmount: crmApp.defaultAmountCents,
    inventoryId: inventory.id,
    inventoryAmount: inventory.defaultAmountCents,
    erpId: customErp.id,
    erpAmount: customErp.defaultAmountCents,
    erpTrialDays: customErp.trialDays,
    starterFreeId: starterFree.id,
  });

  // ── Provisioning API key (from env, sha256-hashed at rest) ───────────────
  const seedKey = process.env.PROVISIONING_SEED_KEY || "pk_demo_change_me";
  const keyHash = createHash("sha256").update(seedKey).digest("hex");
  await db.provisioningKey.upsert({
    where: { keyHash },
    update: { name: "seeded-default" },
    create: { name: "seeded-default", keyHash },
  });

  // ── Sample (inactive) webhook endpoint for platform integration ──────────
  const sampleUrl = "https://example.com/hooks/billing";
  const sample = await db.webhookEndpoint.findFirst({ where: { url: sampleUrl } });
  if (!sample) {
    await db.webhookEndpoint.create({
      data: {
        url: sampleUrl,
        secret: "whsec_demo_secret",
        events: "*",
        isActive: false,
      },
    });
  }

  // ── Payment channel catalog (DB-driven multi-channel) ────────────────────
  // Maya/GrabPay ship inactive — flip isActive in the admin console once the
  // PAYMONGO_SECRET_KEY is set (they reuse the same PayMongo adapter).
  const channels = [
    {
      slug: "gcash-qr",
      label: "GCash QR",
      method: "GCASH_QR",
      provider: "STATIC_QR",
      channelType: "",
      sortOrder: 1,
      isActive: true,
    },
    {
      slug: "paypal",
      label: "PayPal / Card",
      method: "PAYPAL",
      provider: "PAYPAL",
      channelType: "",
      sortOrder: 2,
      isActive: true,
    },
    {
      slug: "maya",
      label: "Maya",
      method: "MAYA",
      provider: "PAYMONGO",
      channelType: "paymaya",
      sortOrder: 3,
      isActive: false,
    },
    {
      slug: "grabpay",
      label: "GrabPay",
      method: "GRABPAY",
      provider: "PAYMONGO",
      channelType: "grabpay",
      sortOrder: 4,
      isActive: false,
    },
  {
      slug: "maribank",
      label: "Maribank",
      method: "MARIBANK",
      provider: "STATIC_QR",
      channelType: "",
      sortOrder: 5,
      isActive: false,
      config: JSON.stringify({
        name: "Maribank Business",
        number: "0917-123-4567",
      }),
    },
  ];
  for (const ch of channels) {
    await db.paymentChannel.upsert({
      where: { slug: ch.slug },
      update: { config: ch.config ?? null },
      create: { ...ch, config: ch.config ?? null },
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Portal login : demo@client.ph / PIN 123456");
  console.log(`   Provisioning : Bearer ${seedKey}`);
}

async function seedSubscriptions(args: {
  clientId: string;
  now: Date;
  som: Date;
  eom: Date;
  somPrev: Date;
  eomPrev: Date;
  somPrevPrev: Date;
  webInfraId: string;
  webInfraAmount: number;
  crmId: string;
  crmAmount: number;
  inventoryId: string;
  inventoryAmount: number;
  erpId: string;
  erpAmount: number;
  erpTrialDays: number;
  starterFreeId: string;
}) {
  const {
    clientId,
    now,
    som,
    eom,
    somPrev,
    eomPrev,
    somPrevPrev,
    webInfraId,
    webInfraAmount,
    crmId,
    crmAmount,
    inventoryId,
    inventoryAmount,
    erpId,
    erpAmount,
    erpTrialDays,
    starterFreeId,
  } = args;

  // 1) PAID — web infra, current cycle settled via PayPal.
  const subWeb = await db.clientSubscription.create({
    data: {
      clientId,
      planId: webInfraId,
      amountCents: webInfraAmount,
      status: SubStatus.PAID,
      billingCycle: BillingCycle.MONTHLY,
      cycleStart: som,
      billingCycleEnd: eom,
    },
  });
  await db.payment.create({
    data: {
      clientId,
      subscriptionId: subWeb.id,
      amountCents: webInfraAmount,
      method: PayMethod.PAYPAL,
      provider: PayProvider.PAYPAL,
      transactionRef: "PAY-20260904-WEB001",
      externalId: "5O190127TN364715T",
      status: PayStatus.PAID,
      paymentDate: minusDays(now, 2),
      meta: JSON.stringify({ note: "Seeded PayPal payment" }),
    },
  });

  // 2) DUE — CRM app, current cycle unpaid (countdown ticking to month end).
  const subCrm = await db.clientSubscription.create({
    data: {
      clientId,
      planId: crmId,
      amountCents: crmAmount,
      status: SubStatus.DUE,
      billingCycle: BillingCycle.MONTHLY,
      cycleStart: som,
      billingCycleEnd: eom,
    },
  });
  await db.payment.create({
    data: {
      clientId,
      subscriptionId: subCrm.id,
      amountCents: crmAmount,
      method: PayMethod.GCASH_QR,
      provider: PayProvider.STATIC_QR,
      transactionRef: "GC-20260826-CRM01",
      status: PayStatus.PAID,
      paymentDate: minusDays(eomPrev, 5),
      meta: JSON.stringify({
        reference: "8021435567",
        note: "Seeded GCash payment",
      }),
    },
  });

  // 3) OVERDUE — inventory portal, previous cycle never settled.
  const subInv = await db.clientSubscription.create({
    data: {
      clientId,
      planId: inventoryId,
      amountCents: inventoryAmount,
      status: SubStatus.OVERDUE,
      billingCycle: BillingCycle.MONTHLY,
      cycleStart: somPrev,
      billingCycleEnd: eomPrev,
    },
  });
  await db.payment.create({
    data: {
      clientId,
      subscriptionId: subInv.id,
      amountCents: inventoryAmount,
      method: PayMethod.GCASH_QR,
      provider: PayProvider.STATIC_QR,
      transactionRef: "GC-20260729-INV01",
      status: PayStatus.PAID,
      paymentDate: minusDays(somPrevPrev, 2),
      meta: JSON.stringify({
        reference: "7719024413",
        note: "Seeded GCash payment",
      }),
    },
  });

  // 4) TRIAL — custom ERP, trial ending ~9 days from now.
  await db.clientSubscription.create({
    data: {
      clientId,
      planId: erpId,
      amountCents: erpAmount,
      status: SubStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      cycleStart: minusDays(plusDays(now, 9), erpTrialDays),
      billingCycleEnd: eom,
      trialEndsAt: plusDays(now, 9),
    },
  });

  // 5) FREE — starter tier, never billed.
  await db.clientSubscription.create({
    data: {
      clientId,
      planId: starterFreeId,
      amountCents: 0,
      status: SubStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      cycleStart: som,
      billingCycleEnd: eom,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
