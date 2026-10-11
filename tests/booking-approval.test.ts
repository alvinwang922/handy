import { describe, expect, it } from "vitest";
import { bookingNeedsReconciliation, getQuoteRevision, isActionableQuote } from "../lib/communications/approval";
import { makeRequest } from "./communications/fixtures";
import type { CallRecord, Quote } from "../lib/types";

const quote: Quote = {
  priceLowUsd: 180, priceHighUsd: 280, pricingType: "flat", visitFeeUsd: 89,
  availability: [], needsInspection: true, scope: "Drain fitting repair", warranty: null,
  conditions: "Fee waived if hired", notes: "", confidence: 0.9, outcome: "quote_received",
  feeTreatment: "waived_if_hired",
};
const quotedCall = (): CallRecord => ({
  ...makeRequest().calls[0], state: "Terminated", terminationType: "completed",
  transcriptHash: "same-transcript", quote, extractionStatus: "validated",
});

describe("booking approval boundary", () => {
  it("changes the revision when extracted terms change on the same transcript", () => {
    const call = quotedCall();
    expect(getQuoteRevision(call)).not.toBe(getQuoteRevision({ ...call, quote: { ...quote, priceHighUsd: 380 } }));
    expect(getQuoteRevision(call)).not.toBe(getQuoteRevision({ ...call, quote: { ...quote, feeTreatment: "additional" } }));
  });

  it("allows an explicitly priced inspection but no declined or information-only offer", () => {
    expect(isActionableQuote({ ...quotedCall(), quote: { ...quote, priceLowUsd: null, priceHighUsd: null, pricingType: "inspection_only", outcome: "inspection_only", visitFeeUsd: 75 } })).toBe(true);
    for (const outcome of ["declined", "needs_information"] as const) {
      expect(isActionableQuote({ ...quotedCall(), quote: { ...quote, outcome } })).toBe(false);
    }
  });

  it("requires reconciliation after unknown dispatch or unread completed booking", () => {
    const booking = { ...quotedCall(), purpose: "booking" as const };
    expect(bookingNeedsReconciliation(makeRequest({ calls: [{ ...booking, dispatchState: "send_unknown" }] }))).toBe(true);
    expect(bookingNeedsReconciliation(makeRequest({ calls: [booking] }))).toBe(true);
  });

  it("requires a verified allowed slot before treating a booking as resolved", () => {
    const request = makeRequest({ offeredSlots: ["October 13, 9–11 AM Pacific"] });
    request.calls = [{ ...quotedCall(), purpose: "booking", booking: { confirmed: true, slot: "October 15, 1–3 PM Pacific", notes: "" } }];
    expect(bookingNeedsReconciliation(request)).toBe(true);
    request.calls[0].booking!.slot = request.offeredSlots[0];
    expect(bookingNeedsReconciliation(request)).toBe(false);
  });
});
