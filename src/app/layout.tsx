import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSIRIS CENTER Billing Portal",
  description:
    "Client billing dashboard — GCash QR & PayPal payments, live countdowns and receipts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
