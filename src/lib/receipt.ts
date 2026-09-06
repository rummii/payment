// PDF receipts via pdf-lib. Note: standard PDF fonts use WinAnsi encoding,
// which cannot encode "₱" — receipts use the "PHP " prefix instead.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPhDateTime } from "./dates";

export interface ReceiptData {
  transactionRef: string;
  clientName: string;
  clientEmail: string;
  planName: string;
  amountCents: number;
  method: string;
  provider: string;
  status: string;
  paymentDate: Date | null;
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.42, 0.46, 0.55);
  const brand = rgb(0.13, 0.65, 0.35);

  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: brand });
  page.drawText("Rummii Billing", {
    x: 48,
    y: 802,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(data.status === "PAID" ? "OFFICIAL RECEIPT" : "PAYMENT RECORD", {
    x: 48,
    y: 778,
    size: 11,
    font: bold,
    color: rgb(0.95, 0.98, 0.94),
  });

  let y = 710;
  const row = (label: string, value: string) => {
    page.drawText(label, { x: 48, y, size: 10, font, color: muted });
    page.drawText(value, { x: 200, y, size: 10, font: bold, color: ink });
    y -= 24;
  };

  row("Reference", data.transactionRef);
  row("Billed to", data.clientName);
  row("Email", data.clientEmail);
  row("Plan / Service", data.planName);
  row("Amount", `PHP ${(data.amountCents / 100).toFixed(2)}`);
  row("Payment method", data.method);
  row("Provider", data.provider);
  row("Status", data.status);
  row(
    "Payment date",
    data.paymentDate ? formatPhDateTime(data.paymentDate) : "—"
  );
  row("Issued", formatPhDateTime(new Date()));

  y -= 20;
  page.drawText("This document was generated automatically by the billing portal.", {
    x: 48,
    y,
    size: 9,
    font,
    color: muted,
  });

  return doc.save();
}
