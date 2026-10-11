import { describe, expect, it } from "vitest";
import { bookingInstruction, formatQuote, quoteInstruction } from "../lib/instructions";
import type { Diagnosis, Provider, Quote } from "../lib/types";

const provider: Provider = {
  id: "plumb_golden", name: "Golden Gate Plumbing", trade: "plumber", phone: "+14155550102",
  rating: 4.6, reviewCount: 154, serviceArea: "San Francisco",
};
const diagnosis: Diagnosis = {
  title: "Leak", likelyCause: "Loose slip nut", trade: "plumber", urgency: "soon", needsOnsiteInspection: false,
  costRangeUsd: [150, 300], jobBrief: "Slow leak under a kitchen sink.", questionsForProviders: [], confidence: 0.8,
};
const quote: Quote = {
  priceLowUsd: 180, priceHighUsd: 250, pricingType: "flat", visitFeeUsd: 89, availability: [],
  needsInspection: true, scope: null, warranty: null, conditions: null, notes: "", confidence: 0.9,
};

describe("quoteInstruction", () => {
  it("discloses the AI, never commits, and withholds the address", () => {
    const text = quoteInstruction(provider, diagnosis, null, "Maple PM");
    expect(text).toContain("AI assistant calling on behalf of Maple PM");
    expect(text).toMatch(/Do NOT book, commit, or agree/);
    expect(text).toMatch(/Do not give the exact address/);
  });

  it("adds the replacement question for recurring unit issues", () => {
    const text = quoteInstruction(provider, diagnosis, {
      priorIssuesSameTrade180d: 3, recommendReplaceQuote: true, note: "3rd plumber issue in 6 months",
    }, "Maple PM");
    expect(text).toContain("replace it instead of repairing it");
  });
});

describe("bookingInstruction", () => {
  it("includes the approved quote, the offered windows and the access details", () => {
    const text = bookingInstruction(provider, diagnosis, quote, ["Tue 9–11am", "Wed 1–3pm"], "124 Maple Avenue, Main home.", "Maple PM");
    expect(text).toContain("$180–$250 (flat); $89 visit fee (whether it is credited is unconfirmed)");
    expect(text).toContain("Tue 9–11am; Wed 1–3pm");
    expect(text).toContain("124 Maple Avenue");
  });
});

describe("formatQuote", () => {
  it("handles a missing quote", () => {
    expect(formatQuote(null)).toBe("no clear quote was captured");
  });
});
