import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingResult, Provider, RepairRequest, RequestStatus, TranscriptTurn } from "../lib/types";
import type { QuoteExtractionInput } from "../lib/communications/mock-quote-extractor";
import { makeRequest } from "./communications/fixtures";
import seededProviders from "../data/providers.json";

interface Dispatch {
  id: string;
  to: string;
  instruction: string;
  purpose: "quote" | "booking";
  completed: boolean;
  transcriptTurns: TranscriptTurn[];
}

const state = vi.hoisted(() => ({
  saved: null as RepairRequest | null,
  providers: [] as Provider[],
  sequence: 0,
  dispatches: [] as Dispatch[],
  active: new Set<string>(),
  maxActive: 0,
  quoteTurns: new Map<string, TranscriptTurn[]>(),
  bookingTurns: [] as TranscriptTurn[],
  extractBooking: vi.fn(),
}));

vi.mock("../lib/config", () => ({
  config: {
    // The transport below is fake, but production booking-evidence checks remain enabled.
    mockDial: false, mockClaude: true, mockKeewano: true, maxConcurrentCalls: 2, quoteFanout: 3,
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
  getProvider: (id: string) => state.providers.find((provider) => provider.id === id) ?? null,
  listProviders: () => state.providers,
  getProperty: () => ({ id: "p1", address: "1 Test Street" }),
  newId: () => `journey_call_${++state.sequence}`,
  nowIso: () => new Date().toISOString(),
}));
vi.mock("../lib/claude", async () => {
  const { mockExtractQuote } = await import("../lib/communications/mock-quote-extractor");
  return {
    extractQuote: async (input: QuoteExtractionInput) => mockExtractQuote(input),
    extractBooking: state.extractBooking,
  };
});
vi.mock("../lib/keewano", () => ({
  track: vi.fn().mockResolvedValue(undefined),
  rankProviders: async () => state.providers.map((provider, index) => ({
    providerId: provider.id, score: 100 - index, answerRate: 1, onTimeRate: 1, quoteAccuracyPct: 100, reason: "Seeded test ranking",
  })),
}));
vi.mock("../lib/parts", () => ({ findPartOptions: vi.fn(), searchingPartSearch: vi.fn() }));
vi.mock("../lib/dial", () => ({
  DialError: class DialError extends Error {},
  placeCall: async (input: { to: string; instruction: string; purpose: "quote" | "booking" }) => {
    const id = `dial_journey_${state.dispatches.length + 1}`;
    const transcriptTurns = input.purpose === "quote" ? state.quoteTurns.get(input.to)! : state.bookingTurns;
    state.dispatches.push({ ...input, id, completed: false, transcriptTurns });
    state.active.add(id);
    state.maxActive = Math.max(state.maxActive, state.active.size);
    return { dialCallId: id };
  },
  getCall: async (id: string) => {
    const dispatch = state.dispatches.find((item) => item.id === id)!;
    if (!dispatch.completed) return { state: "In-Progress", terminationType: null, durationSec: null, transcript: null, transcriptTurns: [] };
    state.active.delete(id);
    return {
      state: "Terminated", terminationType: "completed", durationSec: 45,
      transcript: dispatch.transcriptTurns.map((turn) => `${turn.speaker === "user" ? "User" : "Agent"}: ${turn.text}`).join("\n"),
      transcriptTurns: dispatch.transcriptTurns,
    };
  },
}));

import { getQuoteRevision } from "../lib/communications/approval";
import { rankForRequest, refresh, startBookingCall, startQuoteCalls } from "../lib/orchestrator";

const slots = [
  "Tuesday, October 13, 2026, 9–11 AM Pacific",
  "Wednesday, October 14, 2026, 1–3 PM Pacific",
];
const outsideSlot = "Friday, October 16, 2026, 10 AM–noon Pacific";
const approvedScope = "The repair includes labor and standard P-trap fittings.";

function turns(text: string[]): TranscriptTurn[] {
  return text.map((value, index) => ({ speaker: "user", text: value, startMs: index * 1000, endMs: (index + 1) * 1000 }));
}

function bookingEvidence(slot = slots[1], termsUnchanged = true): BookingResult {
  return {
    confirmed: true,
    outcome: "confirmed",
    slot,
    termsUnchanged,
    notes: "Provider explicitly confirmed the selected window and terms.",
    evidence: [
      { field: "slot", turnIndex: 1, providerText: `Confirmed for ${slot}.` },
      { field: "terms", turnIndex: 2, providerText: state.bookingTurns[2].text },
    ],
  };
}

function approveSelectedQuote(request: RepairRequest) {
  const selected = request.calls.find((call) => call.providerId === state.providers[0].id && call.purpose === "quote")!;
  request.approval = {
    providerId: selected.providerId,
    quoteCallId: selected.id,
    quoteRevision: getQuoteRevision(selected),
    amountUsd: selected.quote!.priceHighUsd,
    approvedAt: new Date().toISOString(),
    consentText: "Approve this repair quote and book either supplied window.",
    basis: "repair_quote",
  };
  return selected;
}

async function collectThreeQuotes() {
  const request = makeRequest({ id: "req_journey", status: "diagnosed", photoPath: null, calls: [] });
  const { ranked, providers } = await rankForRequest(request);
  request.rankedProviders = ranked;
  expect(providers).toHaveLength(3);
  await startQuoteCalls(request, providers);

  // Two calls occupy capacity; the third remains durably queued until one finishes.
  expect(state.dispatches).toHaveLength(2);
  expect(state.saved!.calls.filter((call) => call.state === "queued_local")).toHaveLength(1);
  state.dispatches[0].completed = true;
  await refresh(request.id);
  expect(state.dispatches).toHaveLength(3);
  expect(state.saved!.status).toBe("quoting");
  state.dispatches.forEach((dispatch) => { dispatch.completed = true; });
  const ready = (await refresh(request.id))!;
  expect(ready.status, JSON.stringify(ready.calls.map((call) => ({ providerId: call.providerId, extractionError: call.extractionError })))).toBe("quotes_ready");
  expect(state.maxActive).toBe(2);
  expect(ready.calls.map((call) => call.quote?.priceLowUsd)).toEqual([180, 220, 260]);
  expect(new Set(ready.calls.map((call) => call.providerId)).size).toBe(3);
  expect(ready.calls.every((call) => call.quoteResult?.outcome === "quote_received" && call.quoteResult.evidence.length > 0)).toBe(true);
  expect(state.dispatches.every((dispatch) => dispatch.purpose === "quote")).toBe(true);
  return ready;
}

beforeEach(() => {
  state.saved = null;
  state.providers = (seededProviders as Provider[]).filter((provider) => provider.trade === "plumber").slice(0, 3)
    .map((provider) => ({ ...provider, contactVerified: true }));
  state.sequence = 0;
  state.dispatches = [];
  state.active.clear();
  state.maxActive = 0;
  state.quoteTurns = new Map([
    [state.providers[0].phone, turns([
      "Our flat repair estimate is $180.", approvedScope,
      "There is an $89 diagnostic visit fee, waived if hired.",
      "Tuesday 9 to 11am or Wednesday 1 to 3pm are available.",
      "Our workmanship warranty is 30 days.",
    ])],
    [state.providers[1].phone, turns([
      "Our flat repair quote is $220 with no visit fee.",
      "The repair includes labor and standard fittings.",
      "Tuesday 2 to 4pm and Thursday 9 to 11am are available.",
      "Our workmanship warranty is 60 days.",
    ])],
    [state.providers[2].phone, turns([
      "Our flat repair price is $260.",
      "The repair includes labor and replacing the P-trap.",
      "A separate $40 visit fee is additional.",
      "Wednesday 9 to 11am and Friday 1 to 3pm are available.",
      "Our workmanship warranty is 90 days.",
    ])],
  ]);
  state.bookingTurns = [
    { speaker: "agent", text: `Can you book ${slots.join(" or ")}?`, startMs: 0, endMs: 1000 },
    { speaker: "user", text: `Confirmed for ${slots[1]}.`, startMs: 1000, endMs: 2000 },
    { speaker: "user", text: "The repair remains $180 flat including labor and standard P-trap fittings; the $89 visit fee is waived if hired.", startMs: 2000, endMs: 3000 },
  ];
  state.extractBooking.mockReset().mockImplementation(async () => bookingEvidence());
});

describe("three quotes through approved booking", () => {
  it("queues three quote calls, waits for approval, and books only the selected provider in the second user window", async () => {
    const ready = await collectThreeQuotes();
    const selectedProvider = state.providers[0];
    await expect(startBookingCall(ready, selectedProvider.id, slots, "Ring the doorbell")).rejects.toThrow(/approval/i);
    expect(state.dispatches).toHaveLength(3);

    const approvedCall = approveSelectedQuote(ready);
    await startBookingCall(ready, selectedProvider.id, slots, "Ring the doorbell");
    const bookingDispatches = state.dispatches.filter((dispatch) => dispatch.purpose === "booking");
    expect(bookingDispatches).toHaveLength(1);
    expect(bookingDispatches[0].to).toBe(selectedProvider.phone);
    expect(bookingDispatches[0].instruction).toContain(approvedScope);
    expect(bookingDispatches[0].instruction).toContain("$180");
    expect(bookingDispatches[0].instruction).toContain("$89 diagnostic fee waived if hired");
    for (const slot of slots) expect(bookingDispatches[0].instruction).toContain(slot);
    expect(state.saved!.approval).toMatchObject({ quoteCallId: approvedCall.id, quoteRevision: getQuoteRevision(approvedCall) });

    bookingDispatches[0].completed = true;
    const scheduled = (await refresh(ready.id))!;
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduledSlot).toBe(slots[1]);
    expect(scheduled.selectedProviderId).toBe(selectedProvider.id);
    expect(state.extractBooking).toHaveBeenCalledWith(expect.objectContaining({
      offeredSlots: slots,
      transcriptTurns: state.bookingTurns,
      quoteCallId: approvedCall.id,
      quoteRevision: getQuoteRevision(approvedCall),
      approvedQuote: approvedCall.quote,
      feeTreatment: "waived_if_hired",
    }));
    expect(state.dispatches).toHaveLength(4);
  });

  it("refuses to call when terms change after the recorded approval", async () => {
    const ready = await collectThreeQuotes();
    const approvedCall = approveSelectedQuote(ready);
    approvedCall.quote!.priceHighUsd = 300;
    await expect(startBookingCall(ready, state.providers[0].id, slots, "")).rejects.toThrow(/changed/i);
    expect(state.dispatches).toHaveLength(3);
    expect(state.dispatches.some((dispatch) => dispatch.purpose === "booking")).toBe(false);
  });

  it.each(["changed_terms", "outside_window"] as const)("does not schedule a booking with %s", async (scenario) => {
    const ready = await collectThreeQuotes();
    approveSelectedQuote(ready);
    if (scenario === "changed_terms") {
      state.bookingTurns[2].text = "The repair now costs $350, and the visit fee is no longer waived.";
      state.extractBooking.mockImplementation(async () => bookingEvidence(slots[1], false));
    } else {
      state.bookingTurns[1].text = `Confirmed for ${outsideSlot}.`;
      state.extractBooking.mockImplementation(async () => bookingEvidence(outsideSlot));
    }
    await startBookingCall(ready, state.providers[0].id, slots, "");
    state.dispatches.at(-1)!.completed = true;
    for (let attempt = 0; attempt < 4; attempt += 1) await refresh(ready.id);
    expect(state.saved!.status).not.toBe("scheduled");
    expect(state.saved!.scheduledSlot).toBeNull();
    expect(state.dispatches.filter((dispatch) => dispatch.purpose === "booking")).toHaveLength(1);
    expect(state.dispatches).toHaveLength(4);
  });
});
