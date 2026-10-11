import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallRecord, Provider, QuoteResult, RepairRequest, RequestStatus } from "../lib/types";
import { makeRequest, provider } from "./communications/fixtures";

const state = vi.hoisted(() => ({
  saved: null as RepairRequest | null,
  sequence: 0,
  providers: [] as Provider[],
  placeCall: vi.fn(),
  getCall: vi.fn(),
  extractQuote: vi.fn(),
  extractBooking: vi.fn(),
}));

vi.mock("../lib/config", () => ({
  config: {
    mockDial: true, mockClaude: true, mockKeewano: true, maxConcurrentCalls: 2, quoteFanout: 3,
    quoteCallMaxSec: 240, bookingCallMaxSec: 180, companyName: "Handy", serviceAreaCity: "San Francisco",
    serviceAreaRegion: "CA", propertyTimeZone: "America/Los_Angeles",
  },
}));
vi.mock("../lib/store", () => ({
  getRequest: () => state.saved ? structuredClone(state.saved) : null,
  saveRequest: (request: RepairRequest) => {
    state.saved = structuredClone(request);
    return request;
  },
  setStatus: (request: RepairRequest, status: RequestStatus) => { request.status = status; },
  getProvider: () => provider,
  listProviders: () => state.providers,
  getProperty: () => ({ id: "p1", address: "1 Test Street" }),
  newId: () => `call_${++state.sequence}`,
  nowIso: () => new Date().toISOString(),
}));
vi.mock("../lib/dial", () => ({
  placeCall: state.placeCall,
  getCall: state.getCall,
  DialError: class DialError extends Error {
    constructor(public status: number, message: string, public uncertain = false) { super(message); }
  },
}));
vi.mock("../lib/claude", () => ({ extractQuote: state.extractQuote, extractBooking: state.extractBooking }));
vi.mock("../lib/keewano", () => ({ track: vi.fn().mockResolvedValue(undefined), rankProviders: vi.fn() }));
vi.mock("../lib/parts", () => ({ findPartOptions: vi.fn(), searchingPartSearch: vi.fn() }));

import { DialError } from "../lib/dial";
import { config } from "../lib/config";
import { rankForRequest, refresh, startBookingCall, startQuoteCalls } from "../lib/orchestrator";

const transcript = "User: Our repair quote is $220 flat with no visit fee.";
const transcriptTurns = [{ speaker: "user" as const, text: "Our repair quote is $220 flat with no visit fee.", startMs: 100, endMs: 1000 }];

function call(overrides: Partial<CallRecord> = {}): CallRecord {
  const base = makeRequest().calls[0];
  return {
    ...base,
    quoteJob: {
      schemaVersion: 1, attemptId: base.id, requestId: "req_demo", briefVersion: "brief_1", briefHash: "brief_hash",
      providerId: provider.id, purpose: "quote", idempotencyKey: base.idempotencyKey,
      maxCallDurationSeconds: 240, outboundInstruction: base.outboundInstruction,
    },
    ...overrides,
  };
}

function quoteResult(outcome: QuoteResult["outcome"] = "quote_received"): QuoteResult {
  return {
    requestId: "req_demo", briefVersion: "brief_1", providerId: provider.id, dialCallId: "mock_call_demo",
    extractionMethod: "model", outcome, collectionStatus: "partial", uncollectedFields: ["availability", "warranty"],
    quote: {
      priceLowUsd: outcome === "quote_received" ? 220 : null,
      priceHighUsd: outcome === "quote_received" ? 220 : null,
      pricingType: "flat", visitFeeUsd: 0, availability: [], needsInspection: false,
      scope: "Repair", warranty: null, conditions: null, notes: "Test extraction", confidence: 0.9,
    },
    feeTreatment: "none", missingInformation: [], quoteBasis: "description_only", photoReviewState: "not_reviewed",
    evidence: [{ field: "price", turnIndex: 0, providerText: "$220" }, { field: "fee", turnIndex: 0, providerText: "no visit fee" }],
  };
}

function seed(currentCall: CallRecord, status: RepairRequest["status"] = "quoting") {
  state.saved = makeRequest({ photoPath: null, status, calls: [currentCall] });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.saved = null;
  state.sequence = 0;
  state.providers = [provider];
  config.mockDial = true;
  state.placeCall.mockReset().mockResolvedValue({ dialCallId: "dial_new" });
  state.getCall.mockReset().mockResolvedValue({ state: "Terminated", terminationType: "completed", durationSec: 20, transcript, transcriptTurns });
  state.extractQuote.mockReset().mockResolvedValue(quoteResult());
  state.extractBooking.mockReset();
});

describe("persisted call lifecycle", () => {
  it("filters live contacts and service areas before selecting the quote fanout", async () => {
    config.mockDial = false;
    state.providers = [
      { ...provider, id: "unverified", rating: 5, contactVerified: false },
      { ...provider, id: "outside_area", rating: 4.9, contactVerified: true, serviceArea: "Oakland" },
      { ...provider, id: "verified", rating: 4.5, contactVerified: true },
    ];
    const { providers } = await rankForRequest(makeRequest({ status: "diagnosed", calls: [] }));
    expect(providers.map((item) => item.id)).toEqual(["verified"]);
  });

  it("persists the frozen call and dispatch key before placing a call", async () => {
    state.placeCall.mockImplementation(async (input) => {
      const savedCall = state.saved!.calls[0];
      expect(savedCall.dispatchState).toBe("dispatching");
      expect(savedCall.idempotencyKey).toBe(input.idempotencyKey);
      expect(savedCall.outboundInstruction).toBe(input.instruction);
      expect(savedCall.quoteJob?.requestId).toBe("req_demo");
      expect(input.instruction).not.toBe("");
      return { dialCallId: "dial_new" };
    });
    await startQuoteCalls(makeRequest({ status: "diagnosed", photoPath: null, calls: [] }), [provider]);
    expect(state.placeCall).toHaveBeenCalledTimes(1);
    expect(state.saved!.calls[0]).toMatchObject({ dispatchState: "accepted", dialCallId: "dial_new" });
  });

  it("never dispatches an ambiguous call again while polling", async () => {
    state.placeCall.mockRejectedValue(new DialError(0, "Lost response", true));
    await startQuoteCalls(makeRequest({ status: "diagnosed", photoPath: null, calls: [] }), [provider]);
    await refresh("req_demo");
    await refresh("req_demo");
    expect(state.placeCall).toHaveBeenCalledTimes(1);
    expect(state.saved!.calls[0].dispatchState).toBe("send_unknown");
    expect(state.saved!.notice).toMatch(/unknown.*reconcile/i);
  });

  it.each([
    { outboundInstruction: "", quoteJob: null },
    { outboundInstruction: "Legacy prompt", quoteJob: null },
  ])("fails unsafe legacy queued calls without dialing", async (legacy) => {
    seed(call({ ...legacy, state: "queued_local", dispatchState: "queued", dialCallId: null }));
    await refresh("req_demo");
    expect(state.placeCall).not.toHaveBeenCalled();
    expect(state.saved!.calls[0]).toMatchObject({ dispatchState: "failed", state: "Terminated" });
    expect(state.saved!.calls[0].error).toMatch(/frozen instructions or quote job/);
  });

  it("persists transcript evidence before extraction and retries extraction without redialing", async () => {
    seed(call());
    state.extractQuote.mockImplementationOnce(async () => {
      const savedCall = state.saved!.calls[0];
      expect(savedCall.transcript).toBe(transcript);
      expect(savedCall.transcriptTurns).toEqual(transcriptTurns);
      expect(savedCall.transcriptHash).toMatch(/^[a-f0-9]{64}$/);
      expect(savedCall).toMatchObject({ extractAttempts: 1, extractionStatus: "pending" });
      throw new Error("Model temporarily unavailable");
    });
    await refresh("req_demo");
    expect(state.saved!.calls[0].extractionStatus).toBe("failed");
    await refresh("req_demo");
    expect(state.extractQuote).toHaveBeenCalledTimes(2);
    expect(state.getCall).toHaveBeenCalledTimes(1);
    expect(state.placeCall).not.toHaveBeenCalled();
    expect(state.saved!.status).toBe("quotes_ready");
    expect(state.saved!.calls[0].quote).toMatchObject({ outcome: "quote_received", feeTreatment: "none", collectionStatus: "partial" });
    expect(state.saved!.calls[0].quoteRevision).toMatch(/^[a-f0-9]{64}$/);
  });

  it("waits for call completion before extracting an in-progress transcript", async () => {
    seed(call());
    state.getCall.mockResolvedValueOnce({ state: "In-Progress", terminationType: null, durationSec: 10, transcript, transcriptTurns });
    await refresh("req_demo");
    expect(state.extractQuote).not.toHaveBeenCalled();
    await refresh("req_demo");
    expect(state.extractQuote).toHaveBeenCalledTimes(1);
  });

  it.each(["declined", "needs_information"] as const)("keeps %s results from becoming bookable quotes", async (outcome) => {
    seed(call());
    state.extractQuote.mockResolvedValue(quoteResult(outcome));
    await refresh("req_demo");
    expect(state.saved!.status).toBe("failed");
    expect(state.saved!.calls[0].quote?.outcome).toBe(outcome);
  });

  it("keeps a legacy priced quote actionable", async () => {
    seed(call({ state: "Terminated", terminationType: "completed", transcriptStatus: "ready", transcript,
      quote: quoteResult().quote, extractionStatus: "validated" }));
    await refresh("req_demo");
    expect(state.saved!.status).toBe("quotes_ready");
  });
});

describe("booking reconciliation", () => {
  it("does not dispatch a legacy booking without the approved terms snapshot", async () => {
    seed(call({ purpose: "booking", dispatchState: "queued", state: "queued_local",
      dialCallId: null, quoteJob: null, bookingJob: null }), "booking");
    await refresh("req_demo");
    expect(state.placeCall).not.toHaveBeenCalled();
    expect(state.saved!.calls[0].dispatchState).toBe("failed");
    expect(state.saved!.calls[0].error).toMatch(/booking approval snapshot/);
  });

  it("retains booking state for an unknown dispatch and prevents a new call", async () => {
    seed(call({ purpose: "booking", dispatchState: "send_unknown", state: "Terminated", terminationType: "failed",
      dialCallId: null, transcriptStatus: "unavailable", quoteJob: null }), "booking");
    const updated = await refresh("req_demo");
    expect(updated?.status).toBe("booking");
    expect(updated?.notice).toMatch(/reconcile/i);
    updated!.approval = { providerId: provider.id, amountUsd: 220, approvedAt: new Date().toISOString(), consentText: "Approved" };
    await expect(startBookingCall(updated!, provider.id, ["Tuesday morning"], "")).rejects.toThrow(/reconcile/i);
    expect(state.placeCall).not.toHaveBeenCalled();
  });

  it("keeps an unreadable completed booking blocked after extraction retries are exhausted", async () => {
    seed(call({ purpose: "booking", state: "Terminated", terminationType: "completed", transcriptStatus: "ready", transcript,
      transcriptTurns, quoteJob: null, extractAttempts: 2,
      bookingJob: {
        requestId: "req_demo", providerId: provider.id, quoteCallId: "quote_original", quoteRevision: "revision",
        approvedQuote: quoteResult().quote, feeTreatment: "none", approvalAmountUsd: 220,
        approvalBasis: "repair_quote", offeredSlots: ["Tuesday morning"],
        timeZone: "America/Los_Angeles", referenceAt: "2026-10-11T12:00:00Z",
      },
    }), "booking");
    state.extractBooking.mockRejectedValue(new Error("Cannot establish booking outcome"));
    await refresh("req_demo");
    await refresh("req_demo");
    expect(state.extractBooking).toHaveBeenCalledTimes(1);
    expect(state.saved!.status).toBe("booking");
    expect(state.saved!.notice).toMatch(/unverified.*reconcile/i);
    expect(state.placeCall).not.toHaveBeenCalled();
  });

  it("keeps a completed booking blocked when its transcript never arrives", async () => {
    seed(call({ purpose: "booking", state: "Terminated", terminationType: "completed", transcriptStatus: "unavailable",
      transcript: null, quoteJob: null }), "booking");
    await refresh("req_demo");
    expect(state.saved!.status).toBe("booking");
    expect(state.saved!.notice).toMatch(/reconcile/i);
    expect(state.placeCall).not.toHaveBeenCalled();
  });
});
