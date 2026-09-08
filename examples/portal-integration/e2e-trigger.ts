// E2E helper: create a PENDING PayPal payment, publish payment.failed, then
// drive the delivery to completion (attemptDelivery is fire-and-forget inside
// publishEvent, so we await it explicitly before disconnecting).
//
// Usage: npx tsx examples/portal-integration/e2e-trigger.ts <clientId> <subscriptionId>
import { db } from "../../src/lib/db";
import { PayMethod, PayProvider } from "../../src/lib/constants";
import { createPaymentRecord, markPaymentFailed } from "../../src/lib/paymentsService";
import { attemptDelivery } from "../../src/engine/webhooks";
import { WebhookDeliveryStatus } from "../../src/lib/constants";

async function waitForDelivery(deliveryId: string, timeoutMs = 15000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const d = await db.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!d) return "NOT_FOUND";
    if (d.status !== WebhookDeliveryStatus.PENDING) return d.status;
    await new Promise((r) => setTimeout(r, 250));
  }
  return "TIMEOUT";
}

async function main() {
  // NOTE: argv[1] is the script path under tsx — real args start at argv[2].
  const clientId = process.argv[2];
  const subscriptionId = process.argv[3];
  if (!clientId || !subscriptionId) {
    console.error("usage: e2e-trigger.ts <clientId> <subscriptionId>");
    process.exit(2);
  }

  // 1) Create a PENDING PayPal payment and publish payment.failed.
  const payment = await createPaymentRecord({
    clientId,
    subscriptionId,
    amountCents: 9900,
    method: PayMethod.PAYPAL,
    provider: PayProvider.PAYPAL,
    meta: { note: "e2e-webhook-test" },
  });
  await markPaymentFailed(payment.id, "e2e-webhook-test");
  console.log(`published payment.failed id=${payment.id} ref=${payment.transactionRef}`);

  // 2) The engine fires attemptDelivery fire-and-forget — find the row and
  //    drive it to completion ourselves (keeps this process' DB handle alive).
  const delivery = await db.webhookDelivery.findFirst({
    where: { event: "payment.failed", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (delivery) {
    await attemptDelivery(delivery.id);
    const status = await waitForDelivery(delivery.id);
    const fresh = await db.webhookDelivery.findUnique({ where: { id: delivery.id } });
    console.log(
      `delivery ${delivery.id}: status=${status} attempts=${fresh?.attempts} lastError=${fresh?.lastError ?? "null"}`
    );
  } else {
    console.log("no pending delivery row found");
  }

  // 3) Re-drive any earlier stuck PENDING deliveries (attempts=0, no nextRetryAt).
  const stuck = await db.webhookDelivery.findMany({ where: { status: "PENDING" } });
  for (const d of stuck) {
    await attemptDelivery(d.id);
    const status = await waitForDelivery(d.id);
    console.log(`re-drove ${d.id}: status=${status}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
