export function formatPeso(cents: number): string {
  return `₱${(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Plain "1500.00" style amount for gateway payloads (PayPal/PayMongo). */
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}
