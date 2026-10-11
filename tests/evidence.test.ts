import { describe, expect, it } from "vitest";
import { evidenceSupported, quoteProblems } from "../lib/evidence";
import { QuoteSchema } from "../lib/schemas";
import type { Quote, TranscriptTurn } from "../lib/types";

const turns: TranscriptTurn[] = [
  { speaker: "agent", text: "Is it about $500?", startMs: 0, endMs: 900 },
  { speaker: "user", text: "Flat repair price estimate, one hundred and eighty to two hundred and eighty dollars.", startMs: 1000, endMs: 4000 },
  { speaker: "user", text: "Diagnostic visit fee, eighty nine dollars. Waived if they proceed with the repair.", startMs: 4100, endMs: 7000 },
];

const base: Quote = {
  priceLowUsd: 180, priceHighUsd: 280, pricingType: "flat", visitFeeUsd: 89, availability: [], needsInspection: true,
  scope: null, warranty: null, conditions: "Visit fee waived if repair proceeds", notes: "", confidence: 0.9,
  outcome: "quote_received", collectionStatus: "partial", uncollectedFields: ["availability"], feeTreatment: "waived_if_hired",
  evidence: [
    { field: "price", providerText: "flat repair price estimate one hundred and eighty to two hundred and eighty dollars" },
    { field: "fee", providerText: "Diagnostic visit fee, eighty-nine dollars." },
  ],
};

describe("evidenceSupported", () => {
  it("matches provider turns despite case, punctuation and hyphenation differences", () => {
    expect(evidenceSupported(base.evidence![0], turns)).toBe(true);
    expect(evidenceSupported({ field: "fee", providerText: "diagnostic visit fee eighty nine dollars" }, turns)).toBe(true);
  });

  it("never accepts our own agent's words as evidence", () => {
    expect(evidenceSupported({ field: "price", providerText: "about $500" }, turns)).toBe(false);
  });
});

describe("quoteProblems", () => {
  it("accepts the live-call partial result", () => {
    expect(quoteProblems(base, turns)).toEqual([]);
  });

  it("rejects an inspection fee dressed up as a repair quote", () => {
    expect(quoteProblems({ ...base, outcome: "inspection_only" }, turns)).toContain("an inspection fee is not a repair quote");
  });

  it("keeps unknown fees distinct from 'none'", () => {
    expect(quoteProblems({ ...base, feeTreatment: "none" }, turns)).toContain("feeTreatment none needs visitFeeUsd 0");
  });
});

describe("QuoteSchema", () => {
  it("still accepts legacy quotes without the new fields", () => {
    const { outcome, collectionStatus, uncollectedFields, feeTreatment, evidence, ...legacy } = base;
    void [outcome, collectionStatus, uncollectedFields, feeTreatment, evidence];
    expect(QuoteSchema.safeParse({ ...legacy, pricingType: "visit_fee_plus" }).success).toBe(true);
  });

  it("accepts the new contract fields", () => {
    expect(QuoteSchema.safeParse(base).success).toBe(true);
  });
});
