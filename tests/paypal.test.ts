import { describe, expect, it } from "vitest";
import { mapPayPalCaptureStatus } from "@/payments/paypal";
import { PayStatus } from "@/lib/constants";

describe("mapPayPalCaptureStatus", () => {
  it("maps a COMPLETED capture to PAID", () => {
    expect(mapPayPalCaptureStatus("COMPLETED", "COMPLETED")).toBe(PayStatus.PAID);
  });

  it("maps a PENDING capture to PENDING_VERIFICATION", () => {
    expect(mapPayPalCaptureStatus("APPROVED", "PENDING")).toBe(
      PayStatus.PENDING_VERIFICATION
    );
  });

  it("maps refunded captures to REFUNDED", () => {
    expect(mapPayPalCaptureStatus("COMPLETED", "REFUNDED")).toBe(
      PayStatus.REFUNDED
    );
    expect(mapPayPalCaptureStatus("COMPLETED", "PARTIALLY_REFUNDED")).toBe(
      PayStatus.REFUNDED
    );
  });

  it("maps declined/failed captures to FAILED", () => {
    expect(mapPayPalCaptureStatus("COMPLETED", "DECLINED")).toBe(
      PayStatus.FAILED
    );
    expect(mapPayPalCaptureStatus("COMPLETED", "FAILED")).toBe(PayStatus.FAILED);
    expect(mapPayPalCaptureStatus("COMPLETED", "DENIED")).toBe(
      PayStatus.FAILED
    );
    expect(mapPayPalCaptureStatus("COMPLETED", "BLOCKED")).toBe(
      PayStatus.FAILED
    );
  });

  it("prefers the capture status over the order status", () => {
    // Order is COMPLETED but capture is only PENDING -> not yet PAID.
    expect(mapPayPalCaptureStatus("COMPLETED", "PENDING")).toBe(
      PayStatus.PENDING_VERIFICATION
    );
  });

  it("falls back to order-level status when no capture exists", () => {
    expect(mapPayPalCaptureStatus("COMPLETED", null)).toBe(PayStatus.PAID);
    expect(mapPayPalCaptureStatus("VOIDED", null)).toBe(PayStatus.FAILED);
  });

  it("treats approved/created orders without a capture as PENDING", () => {
    expect(mapPayPalCaptureStatus("APPROVED", null)).toBe(PayStatus.PENDING);
    expect(mapPayPalCaptureStatus("CREATED", null)).toBe(PayStatus.PENDING);
    expect(mapPayPalCaptureStatus("SAVED", null)).toBe(PayStatus.PENDING);
    expect(mapPayPalCaptureStatus("PAYER_ACTION_REQUIRED", null)).toBe(
      PayStatus.PENDING
    );
  });

  it("defaults unknown statuses to PENDING", () => {
    expect(mapPayPalCaptureStatus("UNKNOWN", "ALSO_UNKNOWN")).toBe(
      PayStatus.PENDING
    );
  });
});
