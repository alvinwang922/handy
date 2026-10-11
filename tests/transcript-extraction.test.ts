import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingExtractionInput, BookingResult, QuoteResult, TranscriptTurn } from "../lib/types";
import type { QuoteExtractionInput } from "../lib/communications/mock-quote-extractor";
import { makeRequest } from "./communications/fixtures";

const api = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic { messages = { parse: api.parse }; },
}));
vi.mock("../lib/config", () => ({ config: { mockClaude: false, mockClaudeExtract: false, mockDial: false } }));

import { extractBooking, extractQuote, MODEL_EXTRACT } from "../lib/claude";

const slots = ["Tuesday October 13, 2026, 9–11 AM Pacific", "Wednesday October 14, 2026, 1–3 PM Pacific"];
const quoteTurns: TranscriptTurn[] = [
  { speaker: "agent", text: "The earlier AI estimate was $900. What do you quote?", startMs: 0, endMs: 1000 },
  { speaker: "user", text: "The repair costs two hundred and twenty dollars, including labor and standard fittings. No visit fee.", startMs: 1000, endMs: 2000 },
  { speaker: "user", text: `${slots[0]} is available.`, startMs: 2000, endMs: 3000 },
];
const quoteInput: QuoteExtractionInput = {
  requestId: "request_1", briefVersion: "brief_1", providerId: "provider_1", dialCallId: "dial_quote_1",
  diagnosis: makeRequest().diagnosis!, referenceAt: "2026-10-11T20:00:00Z", timeZone: "America/Los_Angeles",
  transcript: quoteTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n"), transcriptTurns: quoteTurns,
};

function quoteOutput(): QuoteResult {
  return {
    requestId: quoteInput.requestId, briefVersion: quoteInput.briefVersion, providerId: quoteInput.providerId,
    dialCallId: quoteInput.dialCallId, extractionMethod: "model", outcome: "quote_received", collectionStatus: "partial",
    uncollectedFields: ["warranty", "conditions"],
    quote: {
      priceLowUsd: 220, priceHighUsd: 220, pricingType: "flat", visitFeeUsd: 0, availability: [slots[0]],
      scope: "Labor and standard fittings", warranty: null, conditions: null, notes: "Provider estimate", needsInspection: false, confidence: 0.9,
    },
    feeTreatment: "none", missingInformation: [], quoteBasis: "description_only", photoReviewState: "not_reviewed",
    evidence: [
      { field: "price", turnIndex: 1, providerText: "$220" },
      { field: "fee", turnIndex: 1, providerText: "No visit fee" },
      { field: "scope", turnIndex: 1, providerText: "Labor and fittings" },
      { field: "availability", turnIndex: 2, providerText: slots[0] },
    ],
  };
}

function bookingInput(): BookingExtractionInput {
  const transcriptTurns: TranscriptTurn[] = [
    { speaker: "agent", text: `Can you confirm ${slots[1]} at the approved $220 and no visit fee?`, startMs: 0, endMs: 1000 },
    { speaker: "user", text: `Yes, I have booked ${slots[1]}.`, startMs: 1000, endMs: 2000 },
    { speaker: "user", text: "The repair remains $220 including the agreed parts and labor; there is no visit fee.", startMs: 2000, endMs: 3000 },
  ];
  return {
    requestId: quoteInput.requestId, providerId: quoteInput.providerId, quoteCallId: "quote_call_1", quoteRevision: "revision_1",
    approvedQuote: quoteOutput().quote, feeTreatment: "none", approvalAmountUsd: 220, approvalBasis: "repair_quote",
    offeredSlots: slots, timeZone: "America/Los_Angeles", referenceAt: "2026-10-11T20:00:00Z", dialCallId: "dial_booking_1",
    transcriptTurns, transcript: transcriptTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n"),
  };
}

function bookingOutput(): BookingResult {
  return {
    confirmed: true, outcome: "confirmed", slot: slots[1], termsUnchanged: true, notes: "Provider explicitly confirmed.",
    evidence: [{ field: "slot", turnIndex: 1, providerText: slots[1] }, { field: "terms", turnIndex: 2, providerText: "$220" }],
  };
}

const reply = (parsed_output: unknown, stop_reason = "end_turn") => ({ parsed_output, stop_reason });

beforeEach(() => { api.parse.mockReset(); });

describe("production quote extraction", () => {
  it("requests structured output with numbered turns and returns canonical provider evidence", async () => {
    api.parse.mockResolvedValue(reply(quoteOutput()));
    const result = await extractQuote(quoteInput);
    expect(result.quote.priceLowUsd).toBe(220);
    expect(result.evidence[0].providerText).toBe(quoteTurns[1].text);
    const request = api.parse.mock.calls[0][0];
    expect(request.model).toBe(MODEL_EXTRACT);
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.output_config.format.schema.properties.quote.properties).not.toHaveProperty("evidence");
    expect(request.output_config.format.schema.properties.quote.properties).not.toHaveProperty("feeTreatment");
    expect(request.system[0].text).toContain("INCLUDING ZERO requires a fee evidence entry");
    expect(JSON.parse(request.messages[0].content)).toMatchObject({
      requestId: quoteInput.requestId, referenceAt: quoteInput.referenceAt, timeZone: quoteInput.timeZone,
      transcriptTurns: [{ turnIndex: 0, speaker: "agent" }, { turnIndex: 1, speaker: "user" }, { turnIndex: 2, speaker: "user" }],
    });
  });

  it("rejects a quote attributed to another request or provider", async () => {
    api.parse.mockResolvedValue(reply({ ...quoteOutput(), providerId: "another_provider" }));
    await expect(extractQuote(quoteInput)).rejects.toThrow(/wrong repair.*provider/i);
  });

  it("rejects evidence taken from the agent's suggested price", async () => {
    const result = quoteOutput();
    result.evidence[0].turnIndex = 0;
    api.parse.mockResolvedValue(reply(result));
    await expect(extractQuote(quoteInput)).rejects.toThrow(/provider turn/);
  });

  it("rejects an inspection fee presented as a repair price", async () => {
    api.parse.mockResolvedValue(reply({ ...quoteOutput(), outcome: "inspection_only" }));
    await expect(extractQuote(quoteInput)).rejects.toThrow(/not a repair quote/);
  });

  it("rejects a waiver without conditions or supporting evidence", async () => {
    api.parse.mockResolvedValue(reply({ ...quoteOutput(), feeTreatment: "waived_if_hired" }));
    await expect(extractQuote(quoteInput)).rejects.toThrow(/waiver.*conditions/);
  });

  it.each(["refusal", "max_tokens"])("rejects a %s response even if parsed data was returned", async (stop) => {
    api.parse.mockResolvedValue(reply(quoteOutput(), stop));
    await expect(extractQuote(quoteInput)).rejects.toThrow(stop === "refusal" ? /refused/ : /truncated/);
  });

  it("rejects malformed output and does not turn it into an empty quote", async () => {
    api.parse.mockResolvedValue(reply({ quote: { priceLowUsd: "free" } }));
    await expect(extractQuote(quoteInput)).rejects.toThrow();
    api.parse.mockRejectedValue(new Error("Invalid structured JSON"));
    await expect(extractQuote(quoteInput)).rejects.toThrow(/Invalid structured JSON/);
  });

  it("does not call the model without provider transcript turns", async () => {
    await expect(extractQuote({ ...quoteInput, transcriptTurns: [quoteTurns[0]] })).rejects.toThrow(/provider turns/);
    expect(api.parse).not.toHaveBeenCalled();
  });
});

describe("production booking extraction", () => {
  it("supplies frozen approval terms and confirms the second user window with evidence", async () => {
    api.parse.mockResolvedValue(reply({ decision: "resolved", result: bookingOutput() }));
    const input = bookingInput();
    const result = await extractBooking(input);
    expect(result).toMatchObject({ confirmed: true, slot: slots[1], termsUnchanged: true });
    expect(result.evidence?.[1].providerText).toBe(input.transcriptTurns[2].text);
    expect(JSON.parse(api.parse.mock.calls[0][0].messages[0].content)).toMatchObject({
      quoteCallId: input.quoteCallId, quoteRevision: input.quoteRevision, approvedQuote: input.approvedQuote,
      feeTreatment: "none", approvalBasis: "repair_quote", offeredSlots: slots,
    });
  });

  it.each(["changed_terms", "outside_window", "agent_evidence"])("rejects %s instead of scheduling", async (scenario) => {
    const result = bookingOutput();
    if (scenario === "changed_terms") result.termsUnchanged = false;
    if (scenario === "outside_window") result.slot = "Friday noon";
    if (scenario === "agent_evidence") result.evidence![0].turnIndex = 0;
    api.parse.mockResolvedValue(reply({ decision: "resolved", result }));
    await expect(extractBooking(bookingInput())).rejects.toThrow();
  });

  it("requires reconciliation when the model cannot determine whether a booking occurred", async () => {
    api.parse.mockResolvedValue(reply({ decision: "unclear", result: { confirmed: false, slot: null, notes: "Call disconnected." } }));
    await expect(extractBooking(bookingInput())).rejects.toThrow(/ambiguous.*reconcile/);
  });

  it("rejects an unsupported negative result even when the model labels it resolved", async () => {
    api.parse.mockResolvedValue(reply({ decision: "resolved", result: { confirmed: false, slot: null, notes: "No confirmation heard." } }));
    await expect(extractBooking(bookingInput())).rejects.toThrow(/explicit provider outcome/);
  });

  it("accepts an explicit provider refusal with outcome evidence", async () => {
    const input = bookingInput();
    input.transcriptTurns = [{ speaker: "user", text: "We cannot take this job and have not booked an appointment.", startMs: 0, endMs: 1000 }];
    input.transcript = input.transcriptTurns[0].text;
    api.parse.mockResolvedValue(reply({ decision: "resolved", result: {
      confirmed: false, outcome: "declined", slot: null, notes: "Provider refused the job.",
      evidence: [{ field: "outcome", turnIndex: 0, providerText: "Cannot take job" }],
    } }));
    expect(await extractBooking(input)).toMatchObject({ confirmed: false, outcome: "declined", evidence: [{ providerText: input.transcript }] });
  });

  it.each(["refusal", "max_tokens"])("keeps a booking unresolved after %s", async (stop) => {
    api.parse.mockResolvedValue(reply({ decision: "resolved", result: bookingOutput() }, stop));
    await expect(extractBooking(bookingInput())).rejects.toThrow(stop === "refusal" ? /refused/ : /truncated/);
  });
});
