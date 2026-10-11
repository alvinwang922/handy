import { describe, expect, it } from "vitest";
import { validateBookingResult } from "../../lib/communications/booking-contract";
import type { BookingExtractionInput, BookingResult } from "../../lib/types";

const slots = ["Tuesday, October 13, 2026, 9–11 AM Pacific", "Wednesday, October 14, 2026, 1–3 PM Pacific"];
const input: BookingExtractionInput = {
  requestId: "req_1", providerId: "provider_1", quoteCallId: "quote_1", quoteRevision: "approved_revision",
  approvedQuote: {
    priceLowUsd: 220, priceHighUsd: 220, pricingType: "flat", visitFeeUsd: 0, availability: slots,
    needsInspection: false, scope: "Replace the P-trap", warranty: null, conditions: null, notes: "", confidence: 0.9,
  },
  feeTreatment: "none", approvalAmountUsd: 220, approvalBasis: "repair_quote", offeredSlots: slots,
  timeZone: "America/Los_Angeles", referenceAt: "2026-10-11T20:00:00Z", dialCallId: "dial_booking_1",
  transcript: "Agent: Can you book Wednesday?\nUser: Yes, Wednesday works at the same price.",
  transcriptTurns: [
    { speaker: "agent", text: "Can you book Wednesday at $220?", startMs: 0, endMs: 1000 },
    { speaker: "user", text: `Yes, confirmed for ${slots[1]}.`, startMs: 1000, endMs: 2000 },
    { speaker: "user", text: "The repair is still two hundred and twenty dollars, including labor and parts, with no visit fee.", startMs: 2000, endMs: 3000 },
    { speaker: "user", text: "We cannot take this job and have not booked any visit.", startMs: 3000, endMs: 4000 },
    { speaker: "user", text: " ", startMs: 4000, endMs: 5000 },
  ],
};

function confirmed(overrides: Partial<BookingResult> = {}): BookingResult {
  return {
    confirmed: true, outcome: "confirmed", slot: slots[1], termsUnchanged: true, notes: "Provider confirmed.",
    evidence: [
      { field: "slot", turnIndex: 1, providerText: "Wednesday" },
      { field: "terms", turnIndex: 2, providerText: "$220" },
    ],
    ...overrides,
  };
}

describe("booking result contract", () => {
  it("accepts the exact second approved window and retains canonical provider speech", () => {
    const result = validateBookingResult(confirmed(), input, true);
    expect(result.slot).toBe(slots[1]);
    expect(result.evidence?.map((span) => span.providerText)).toEqual([
      input.transcriptTurns[1].text, input.transcriptTurns[2].text,
    ]);
  });

  it("rejects a slot outside the approved windows", () => {
    expect(() => validateBookingResult(confirmed({ slot: "Friday 10 AM" }), input, true)).toThrow(/approved windows exactly/);
  });

  it("rejects changed terms even for a simulated booking", () => {
    expect(() => validateBookingResult(confirmed({ termsUnchanged: false }), input, false)).toThrow(/changed terms/i);
    expect(() => validateBookingResult(confirmed({ outcome: "revised_terms" }), input, true)).toThrow(/changed terms/i);
  });

  it("requires explicit unchanged terms and both evidence fields on live confirmations", () => {
    expect(() => validateBookingResult(confirmed({ termsUnchanged: undefined }), input, true)).toThrow(/unchanged approved terms/);
    expect(() => validateBookingResult(confirmed({ evidence: [{ field: "slot", turnIndex: 1, providerText: "Wednesday" }] }), input, true)).toThrow(/unchanged approved terms/);
  });

  it.each([0, 99, 4])("rejects agent, missing, or empty evidence turn %i", (turnIndex) => {
    const result = confirmed();
    result.evidence![0].turnIndex = turnIndex;
    expect(() => validateBookingResult(result, input, true)).toThrow(/provider's transcript turns/);
  });

  it("rejects ambiguous live negative results so they require reconciliation", () => {
    expect(() => validateBookingResult({ confirmed: false, slot: null, notes: "Cannot determine what happened" }, input, true)).toThrow(/explicit provider outcome.*reconcile/);
    expect(() => validateBookingResult({ confirmed: false, outcome: "unknown", slot: null, notes: "Unclear" }, input, true)).toThrow();
  });

  it("requires provider outcome evidence for an explicit live refusal", () => {
    expect(() => validateBookingResult({ confirmed: false, outcome: "declined", slot: null, notes: "Declined" }, input, true)).toThrow(/supporting evidence/);
    expect(() => validateBookingResult({
      confirmed: false, outcome: "declined", slot: null, notes: "Declined",
      evidence: [{ field: "outcome", turnIndex: 0, providerText: "Declined" }],
    }, input, true)).toThrow(/provider's transcript turns/);
  });

  it("allows an explicit provider refusal and preserves its evidence", () => {
    const result = validateBookingResult({
      confirmed: false, outcome: "declined", slot: null, notes: "Provider cannot take the job.",
      evidence: [{ field: "outcome", turnIndex: 3, providerText: "We cannot take this job." }],
    }, input, true);
    expect(result).toMatchObject({ confirmed: false, outcome: "declined", slot: null });
    expect(result.evidence?.[0].providerText).toBe(input.transcriptTurns[3].text);
  });

  it("rejects contradictory confirmation and outcome flags", () => {
    expect(() => validateBookingResult({ confirmed: false, outcome: "confirmed", slot: null, notes: "" }, input, false)).toThrow(/cannot declare a confirmed outcome/);
  });

  it("permits legacy simulated negative results without enabling that behavior for live calls", () => {
    const result = { confirmed: false, slot: null, notes: "Simulated no booking" };
    expect(validateBookingResult(result, input, false).confirmed).toBe(false);
    expect(() => validateBookingResult(result, input, true)).toThrow(/reconcile/);
  });
});
