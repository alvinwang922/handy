import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest, provider } from "./fixtures";
import { mockExtractQuote } from "../../lib/communications/mock-quote-extractor";

describe("app quote-call contract", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_DIAL", "1");
    vi.stubEnv("SERVICE_AREA_CITY", "San Francisco");
    vi.stubEnv("SERVICE_AREA_REGION", "CA");
    vi.stubEnv("PROPERTY_TIME_ZONE", "America/Los_Angeles");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("freezes a provider-safe brief and a stable dispatch key before calling", async () => {
    const { buildQuoteJob } = await import("../../lib/communications/call-contract");
    const request = makeRequest({ status: "diagnosed", requesterRole: "homeowner", photoPath: null });
    const job = buildQuoteJob(request, provider, "call_123");

    expect(job).toMatchObject({
      attemptId: "call_123",
      requestId: request.id,
      providerId: provider.id,
      idempotencyKey: "handy:quote:call_123",
    });
    expect(job.outboundInstruction).toContain("San Francisco, CA");
    expect(job.outboundInstruction).toContain("for a homeowner");
    expect(job.outboundInstruction).toContain(request.description);
    expect(job.outboundInstruction).not.toContain("1 Private Way");
    expect(job.outboundInstruction).not.toContain(String(request.diagnosis?.costRangeUsd[0]));
  });

  it("anchors evidence to a provider turn and stores canonical transcript text", async () => {
    const { buildQuoteJob, validateQuoteResult } = await import("../../lib/communications/call-contract");
    const request = makeRequest({ status: "diagnosed", photoPath: null });
    const job = buildQuoteJob(request, provider, "call_123");
    const source = {
      dialCallId: "dial_123",
      direction: "outbound" as const,
      terminationType: "completed",
      transcript: "Agent: Is it $180?\nUser: Our estimate is one hundred and eighty dollars, with no visit fee.",
      turns: [
        { speaker: "agent" as const, text: "Is it $180?", startMs: 0, endMs: 100 },
        { speaker: "user" as const, text: "Our estimate is one hundred and eighty dollars, with no visit fee.", startMs: 100, endMs: 500 },
      ],
    };
    const raw = {
      requestId: request.id,
      briefVersion: job.briefVersion,
      providerId: provider.id,
      dialCallId: source.dialCallId,
      extractionMethod: "model",
      outcome: "quote_received",
      collectionStatus: "partial",
      uncollectedFields: ["availability", "warranty", "scope"],
      quote: {
        priceLowUsd: 180, priceHighUsd: 180, pricingType: "flat", visitFeeUsd: 0, availability: [],
        needsInspection: false, scope: null, warranty: null, conditions: null, notes: "model", confidence: 0.9,
      },
      feeTreatment: "none",
      missingInformation: [],
      quoteBasis: "description_only",
      photoReviewState: "not_reviewed",
      evidence: [
        { field: "price", turnIndex: 1, providerText: "$180" },
        { field: "fee", turnIndex: 1, providerText: "no visit fee" },
      ],
    };

    const result = validateQuoteResult(raw, job, source);
    expect(result.evidence[0].providerText).toBe(source.turns[1].text);
    expect(() => validateQuoteResult({ ...raw, evidence: [{ field: "price", turnIndex: 0, providerText: "$180" }] }, job, source)).toThrow(/provider turn/);
  });

  it("keeps an inspection fee separate from a repair price", async () => {
    const { buildQuoteJob, validateQuoteResult } = await import("../../lib/communications/call-contract");
    const request = makeRequest({ status: "diagnosed", photoPath: null });
    const job = buildQuoteJob(request, provider, "call_123");
    const source = {
      dialCallId: "dial_123",
      direction: "outbound" as const,
      terminationType: "completed",
      transcript: "User: We only offer a $75 inspection; repair price is unknown.",
      turns: [{ speaker: "user" as const, text: "We only offer a $75 inspection; repair price is unknown.", startMs: 0, endMs: 100 }],
    };
    const raw = {
      requestId: request.id, briefVersion: job.briefVersion, providerId: provider.id, dialCallId: source.dialCallId,
      extractionMethod: "model", outcome: "inspection_only", collectionStatus: "partial",
      uncollectedFields: ["availability", "fee_treatment"],
      quote: {
        priceLowUsd: null, priceHighUsd: null, pricingType: "inspection_only", visitFeeUsd: 75, availability: [],
        needsInspection: true, scope: "Inspection", warranty: null, conditions: "Repair price unknown", notes: "model", confidence: 0.9,
      },
      feeTreatment: "unknown", missingInformation: [], quoteBasis: "inspection_required", photoReviewState: "not_reviewed",
      evidence: [{ field: "fee", turnIndex: 0, providerText: "$75" }],
    };
    expect(validateQuoteResult(raw, job, source).quote).toMatchObject({ priceLowUsd: null, visitFeeUsd: 75, pricingType: "inspection_only" });
    expect(() => validateQuoteResult({
      ...raw,
      quote: { ...raw.quote, priceLowUsd: 75 },
      evidence: [...raw.evidence, { field: "price", turnIndex: 0, providerText: "$75" }],
    }, job, source)).toThrow(/not a repair quote/);
  });
});

describe("deterministic development extraction", () => {
  it("keeps a flat price beside a free fee and recognizes compact clock times", () => {
    const providerText = "Our flat repair quote is $220 and there is no visit fee. It is not hourly. Tuesday 9–11am or Wednesday 1–3pm.";
    const result = mockExtractQuote({
      requestId: "req_1", briefVersion: "brief_1", providerId: "provider_1", dialCallId: "dial_1",
      transcript: `User: ${providerText}`,
      transcriptTurns: [{ speaker: "user", text: providerText, startMs: 0, endMs: 1000 }],
      diagnosis: makeRequest().diagnosis!,
    });
    expect(result.outcome).toBe("quote_received");
    expect(result.quote).toMatchObject({ priceLowUsd: 220, pricingType: "flat", visitFeeUsd: 0 });
    expect(result.quote.availability).toHaveLength(1);
  });

  it("understands spoken-number ranges and conditional fees", () => {
    const providerText = "Our flat repair estimate is one hundred and eighty to two hundred and eighty dollars, including labor and standard fittings. The eighty nine dollar diagnostic fee is waived if hired.";
    const result = mockExtractQuote({
      requestId: "req_1", briefVersion: "brief_1", providerId: "provider_1", dialCallId: "dial_1",
      transcript: `User: ${providerText}\nUser: October 13, 2026 from 2 to 4 PM is available.`,
      transcriptTurns: [
        { speaker: "user", text: providerText, startMs: 0, endMs: 1000 },
        { speaker: "user", text: "October 13, 2026 from 2 to 4 PM is available.", startMs: 1000, endMs: 1400 },
      ],
      diagnosis: makeRequest().diagnosis!,
    });
    expect(result.quote).toMatchObject({ priceLowUsd: 180, priceHighUsd: 280, visitFeeUsd: 89, pricingType: "flat" });
    expect(result.feeTreatment).toBe("waived_if_hired");
    expect(result.evidence.every((item) => item.turnIndex >= 0)).toBe(true);
  });
});
