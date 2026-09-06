// Payment receipt email — fired from markPaymentPaid after settlement.

import { formatPeso } from "../lib/currency";
import { formatPhDateTime } from "../lib/dates";
import { dispatchEmail } from "./dispatch";
import { itemRow, layout, portalLink } from "./templates";

export async function sendPaymentReceiptEmail(args: {
  to: string;
  clientName: string;
  planName: string;
  amountCents: number;
  reference: string;
  method: string;
  paymentDate: Date;
}): Promise<void> {
  const subject = `Payment received — ${formatPeso(args.amountCents)} (${args.reference})`;
  const html = layout(
    "We received your payment",
    `<p>Hi ${args.clientName}, thank you! Your payment has been confirmed.</p>
     <table style="width:100%;border-collapse:collapse;">
       ${itemRow("Plan", args.planName)}
       ${itemRow("Amount paid", formatPeso(args.amountCents))}
       ${itemRow("Method", args.method)}
       ${itemRow("Reference", args.reference)}
       ${itemRow("Date", formatPhDateTime(args.paymentDate))}
     </table>
     <p style="margin:24px 0 4px;"><a href="${portalLink(`/api/payments/${args.reference}/receipt`)}" style="background:#22c55e;color:#04121f;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;">Download PDF receipt</a></p>`
  );
  await dispatchEmail({
    to: args.to,
    subject,
    html,
    text: `Payment received: ${formatPeso(args.amountCents)} ref ${args.reference}`,
  });
}
