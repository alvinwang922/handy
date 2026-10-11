import { describe, expect, it } from "vitest";
import { brief, scenarios } from "../prototypes/dial-contract/scenarios";
import { buildQuoteJob, validateExtractedQuote, validateHandoff } from "../prototypes/dial-contract/contract";

describe("assessment to Dial prototype contract", () => {
  it.each(["diy", "needs_more_info", "emergency"])("blocks %s before dispatch", recommendedPath => {
    expect(() => validateHandoff({ ...brief, recommendedPath }, scenarios[0].provider)).toThrow();
  });
  it("blocks an emergency even if professional was selected", () => {
    expect(() => validateHandoff({ ...brief, diagnosis: { ...brief.diagnosis, urgency: "emergency" } }, scenarios[0].provider)).toThrow();
  });
  it("requires both verified contact and matching service area", () => {
    for (const patch of [{ contactVerified: false }, { serviceAreaMatch: false }, { trade: "hvac" }]) {
      expect(() => validateHandoff(brief, { ...scenarios[0].provider, ...patch })).toThrow();
    }
  });
  it("keeps receptionist answers out of coordinator instructions", () => {
    const job = buildQuoteJob(brief, scenarios[0].provider, "test");
    expect(job.outboundInstruction).not.toContain("220");
    expect(job.outboundInstruction).toContain("Never book");
    expect(job.outboundInstruction).toContain("94110");
  });
  it("freezes job content and changes the hash when the brief changes", () => {
    const job = buildQuoteJob(brief, scenarios[0].provider, "test");
    const next = buildQuoteJob({ ...brief, observedDescription: "Different symptom", briefVersion: "brief_2" }, scenarios[0].provider, "test2");
    expect(job.briefHash).not.toBe(next.briefHash);
    expect(job.outboundInstruction).not.toContain("Different symptom");
  });
});

const job = buildQuoteJob(brief, scenarios[0].provider, "evidence-test");
const source = { dialCallId: "test-call", direction: "outbound", terminationType: "completed", transcript: "Provider: Inspection costs $75. Repair price is unknown.", turns: [
  { speaker: "agent", text: "Is the repair $220?", startMs: 0, endMs: 100 },
  { speaker: "user", text: "Inspection costs $75. Repair price is unknown.", startMs: 100, endMs: 200 },
] };
const extracted = {
  requestId: brief.requestId, briefVersion: brief.briefVersion, providerId: scenarios[0].provider.id, dialCallId: "test-call", extractionMethod: "human_review", outcome: "inspection_only",
  collectionStatus: "partial", uncollectedFields: ["availability"],
  quote: { priceLowUsd: null, priceHighUsd: null, pricingType: "inspection_only", visitFeeUsd: 75, availability: [], needsInspection: true, scope: "Inspection only", warranty: null, conditions: "Repair price unknown", notes: "Reviewed evidence", confidence: 0.9 },
  feeTreatment: "additional", missingInformation: [], quoteBasis: "inspection_required", photoReviewState: "not_reviewed",
  evidence: [{ field: "fee", turnIndex: 1, providerText: "Inspection costs $75." }],
};
describe("quote evidence validation", () => {
  it("accepts a fee-only result without inventing a repair quote", () => {
    expect(validateExtractedQuote(extracted, job, source).quote.priceLowUsd).toBeNull();
  });
  it("rejects the caller's suggested amount as provider evidence", () => {
    expect(() => validateExtractedQuote({ ...extracted, evidence: [{ field: "price", turnIndex: 0, providerText: "Is the repair $220?" }] }, job, source)).toThrow(/provider/);
  });
  it("rejects promoting an inspection fee to a repair quote", () => {
    expect(() => validateExtractedQuote({ ...extracted, quote: { ...extracted.quote, priceLowUsd: 75 }, evidence: [{ field: "fee", turnIndex: 1, providerText: "Inspection costs $75." }, { field: "price", turnIndex: 1, providerText: "Inspection costs $75." }] }, job, source)).toThrow(/inspection fee/);
  });
  it("rejects stale quote associations", () => {
    expect(() => validateExtractedQuote({ ...extracted, briefVersion: "older" }, job, source)).toThrow(/wrong repair/);
  });
  it("rejects unsupported monetary values", () => {
    expect(() => validateExtractedQuote({ ...extracted, evidence: [{ field: "scope", turnIndex: 1, providerText: "Repair price is unknown." }] }, job, source)).toThrow(/fee requires/);
  });
  it("does not treat a completed voice call as a fully collected quote", () => {
    expect(() => validateExtractedQuote({ ...extracted, collectionStatus: "complete", uncollectedFields: [] }, job, source)).toThrow(/availability/);
  });
  it("distinguishes a confirmed zero visit fee from an unknown fee", () => {
    expect(() => validateExtractedQuote({ ...extracted, feeTreatment: "none", quote: { ...extracted.quote, visitFeeUsd: null } }, job, source)).toThrow(/confirmed zero/);
  });
  it("keeps a waiver conditional on the provider's stated terms", () => {
    expect(() => validateExtractedQuote({ ...extracted, feeTreatment: "waived_if_hired" }, job, source)).toThrow(/waiver/);
  });
  it("does not infer fee treatment from a known inspection price", () => {
    expect(() => validateExtractedQuote({ ...extracted, feeTreatment: "unknown" }, job, source)).toThrow(/fee treatment/);
    expect(validateExtractedQuote({ ...extracted, feeTreatment: "unknown", uncollectedFields: ["availability", "fee_treatment"] }, job, source).feeTreatment).toBe("unknown");
  });
});
