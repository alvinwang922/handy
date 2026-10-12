import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import * as appModule from "../server/app.js";
import * as repairs from "../server/repairs.js";
import { callStage, toAssessment, toQuote as toQuoteJs } from "../server/integrations/live.js";

// The Look B server is plain JS; give the test loose types for it.
/* eslint-disable @typescript-eslint/no-explicit-any */
const createHandy = repairs.createHandy as (options: { dataPath: string; seed: boolean; live: unknown }) => any;
const toQuote = toQuoteJs as (...args: unknown[]) => any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const sunday = new Date("2026-10-11T12:00:00");
const rooter = { id: "plumb_rooter", name: "Bay Area Rooter", rating: 4.8, reviewCount: 212 };
const quote = (over: Record<string, unknown> = {}) => ({
  priceLowUsd: 180, priceHighUsd: 250, pricingType: "flat", visitFeeUsd: 89, feeTreatment: "waived_if_hired",
  availability: ["Tuesday, October 13, 9 to 11 a.m.", "Wednesday afternoon"], needsInspection: false,
  scope: "Drain repair", warranty: "90-day workmanship", conditions: null, notes: "", confidence: 0.9, ...over,
});
const call = (over: Record<string, unknown> = {}) => ({
  id: "call_q1", providerId: "plumb_rooter", purpose: "quote", state: "Terminated", terminationType: "completed",
  durationSec: 120, transcriptTurns: [{ speaker: "agent", text: "Hi, this is an AI assistant" }, { speaker: "user", text: "$180 to $250" }],
  quote: quote(), quoteResult: null, quoteRevision: "rev1", booking: null, extractionStatus: "validated", startedAt: "2026-10-11T19:00:00Z", ...over,
});

describe("live mappers", () => {
  it("turns an answered, priced call into an approvable quote with only the slots that name a day and time", () => {
    const q = toQuote(call(), rooter, sunday);
    expect(q).toMatchObject({ id: "call_q1", amountCents: 25000, priceText: "$180–$250", feeText: "$89 visit fee waived if hired", quoteRevision: "rev1", live: true });
    expect(q.windows).toHaveLength(1);
    expect(q.windows[0].text).toBe("Tuesday, October 13, 9 to 11 a.m.");
    expect(new Date(q.windows[0].start).getHours()).toBe(9);
    expect(new Date(q.windows[0].end).getHours()).toBe(11);
  });

  it("offers nothing to approve without a price or an answered call", () => {
    expect(toQuote(call({ quote: quote({ priceLowUsd: null, priceHighUsd: null }) }), rooter, sunday)).toBeNull();
    expect(toQuote(call({ terminationType: "no-answer" }), rooter, sunday)).toBeNull();
  });

  it.each([
    [{ state: "queued_local" }, "wait"],
    [{ state: "Ringing" }, "ring"],
    [{ state: "In-Progress" }, "talk"],
    [{ state: "Terminated", terminationType: "no-answer" }, "bad"],
    [{ state: "Terminated", terminationType: "completed", quote: null, extractionStatus: "pending" }, "read"],
    [{ state: "Terminated", terminationType: "completed" }, "ok"],
  ])("call stage %o is %s", (over, stage) => {
    expect(callStage(call(over))).toBe(stage);
  });

  it("marks an emergency diagnosis as a hazard", () => {
    const a = toAssessment({ status: "emergency", notice: "Leave now", diagnosis: { trade: "other", urgency: "emergency", title: "Gas", confidence: 0, safetyGuidance: "Leave and call 911" } });
    expect(a).toMatchObject({ hazard: true, text: "Leave and call 911", live: true });
  });
});

// A fake backend: the same responses the Next.js API gives, driven step by step by the test.
function fakeBackend() {
  const state: Record<string, unknown> & { calls: unknown[]; status: string } = {
    id: "req_live1", status: "diagnosed", calls: [], rankedProviders: [], unitInsight: null, notice: null, scheduledSlot: null,
    diagnosis: { trade: "plumber", urgency: "routine", title: "Drain leak", likelyCause: "Loose trap", summary: "", jobBrief: "Fix the drain", confidence: 0.6, costRangeUsd: [150, 450], source: "live" },
  };
  const sent: Record<string, unknown> = {};
  const client = {
    providers: async () => [rooter, { id: "plumb_mission", name: "Mission Pipe Pros", rating: 4.4, reviewCount: 90 }],
    create: async () => ({ ...state }),
    outreach: async () => {
      Object.assign(state, { status: "quoting", calls: [call({ state: "In-Progress", terminationType: null, quote: null })],
        rankedProviders: [{ providerId: "plumb_rooter", score: 96, reason: "Answers 92% of calls" }, { providerId: "plumb_mission", score: 64, reason: "Answers 59% of calls" }] });
      return { ...state };
    },
    get: async () => ({ ...state }),
    book: async (_id: string, body: Record<string, unknown>) => {
      Object.assign(sent, body);
      Object.assign(state, { status: "booking", calls: [...state.calls, call({ id: "call_b1", purpose: "booking", state: "Ringing", terminationType: null, quote: null })] });
      return { ...state };
    },
  };
  return { client, state, sent };
}

const handies: { close(): void }[] = [];
afterEach(() => handies.splice(0).forEach((h) => h.close()));
const issue = (property = "p1") => ({ title: "Leak under the sink", description: "Drips when the faucet runs", property, room: "Kitchen", urgency: "Soon", photos: [] });

describe("Look B in live mode", () => {
  it("runs report → calling → prices → approve → booking call → booked from the real backend's states", async () => {
    const { client, state, sent } = fakeBackend();
    const handy = createHandy({ dataPath: ":memory:", seed: false, live: client }); handies.push(handy);

    const r1 = await handy.createRepair(issue());
    expect(r1).toMatchObject({ status: "assessment", demo: false, live: { requestId: "req_live1" } });
    expect(r1.assessment).toMatchObject({ title: "Drain leak", trade: "Plumber", source: "live:claude-diagnosis" });

    const r2 = await handy.getQuotes(r1.id);
    expect(r2.status).toBe("quoting");
    expect(r2.outreach[0]).toMatchObject({ providerName: "Bay Area Rooter", liveStage: "talk" });
    expect(r2.discovery.providers.map((p: { id: string; called: boolean }) => [p.id, p.called])).toEqual([["plumb_rooter", true], ["plumb_mission", false]]);

    Object.assign(state, { status: "quotes_ready", calls: [call({ quote: quote({ availability: ["tomorrow at 2pm"] }) })] });
    const r3 = await handy.sync(r1.id);
    await handy.sync(r1.id); // a second poll must not duplicate events
    expect(r3.status).toBe("quotes");
    expect(r3.quotes).toHaveLength(1);
    const events = handy.timeline(r1.id).map((e: { type: string }) => e.type);
    expect(events.filter((t: string) => t === "quote.received")).toHaveLength(1);

    const q = r3.quotes[0];
    await handy.approve(r1.id, { quoteId: q.id, amountCents: q.amountCents, consent: true });
    const r4 = await handy.book(r1.id, { windows: [{ start: q.windows[0].start, end: q.windows[0].end }], access: "Side door" });
    expect(r4.status).toBe("booking");
    expect(sent).toMatchObject({ providerId: "plumb_rooter", quoteCallId: "call_q1", quoteRevision: "rev1", slots: ["tomorrow at 2pm"], accessNote: "Side door" });

    Object.assign(state, { status: "scheduled", scheduledSlot: "tomorrow at 2pm", calls: [call(), call({ id: "call_b1", purpose: "booking", quote: null, booking: { confirmed: true } })] });
    const r5 = await handy.sync(r1.id);
    expect(r5).toMatchObject({ status: "scheduled", appointment: "tomorrow at 2pm", booking: { status: "confirmed", live: true, window: { start: q.windows[0].start } } });
    expect(handy.timeline(r1.id).map((e: { type: string }) => e.type)).toContain("appointment.confirmed");
  });

  it("goes back to picking times when the provider doesn't confirm", async () => {
    const { client, state } = fakeBackend();
    const handy = createHandy({ dataPath: ":memory:", seed: false, live: client }); handies.push(handy);
    const r = await handy.createRepair(issue());
    await handy.getQuotes(r.id);
    Object.assign(state, { status: "quotes_ready", calls: [call({ quote: quote({ availability: ["tomorrow at 2pm"] }) })] });
    const { quotes: [q] } = await handy.sync(r.id);
    await handy.approve(r.id, { quoteId: q.id, amountCents: q.amountCents, consent: true });
    await handy.book(r.id, { windows: [{ start: q.windows[0].start, end: q.windows[0].end }] });
    Object.assign(state, { status: "quotes_ready", notice: "The provider couldn't do those times." });
    const after = await handy.sync(r.id);
    expect(after).toMatchObject({ status: "scheduling", approval: { quoteId: "call_q1" }, live: { notice: "The provider couldn't do those times." } });
  });

  it("keeps added houses and seeded samples in demo mode, and refuses live reschedules", async () => {
    const { client } = fakeBackend();
    const handy = createHandy({ dataPath: ":memory:", seed: true, live: client }); handies.push(handy);
    expect(handy.listRepairs().every((r: { demo: boolean }) => r.demo)).toBe(true);
    const house = handy.addProperty({ name: "Beach house", address: "1 Shore Rd" });
    const demo = await handy.createRepair(issue(house.id));
    expect(demo).toMatchObject({ demo: true });
    expect(demo.live).toBeUndefined();
    const live = await handy.createRepair(issue("p1"));
    expect(() => handy.reschedule(live.id)).toThrow(/live booking/);
  });
});

// The HTTP layer in demo mode (no live client): the scripted flow must keep working end to end.
describe("Look B HTTP in demo mode", () => {
  it("reports, gets prices, approves and books through the API", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { server, handy } = (appModule.createApp as (o: { dataPath: string }) => any)({ dataPath: ":memory:" });
    handies.push(handy);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const api = async (method: string, path: string, body?: unknown) => {
      const res = await fetch(base + path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data.error}`);
      return data;
    };
    try {
      expect(await api("GET", "/api/health")).toMatchObject({ mode: "demo" });
      const { repair } = await api("POST", "/api/repairs", issue());
      expect(repair).toMatchObject({ status: "assessment", demo: true });
      const quoted = (await api("POST", `/api/repairs/${repair.id}/quotes`, {})).repair;
      expect(quoted.status).toBe("quotes");
      const q = quoted.quotes[0];
      expect((await api("POST", `/api/repairs/${repair.id}/approve`, { quoteId: q.id, amountCents: q.amountCents, consent: true })).repair.status).toBe("scheduling");
      const booked = (await api("POST", `/api/repairs/${repair.id}/book`, { windows: [q.windows[0]], access: "Side door" })).repair;
      expect(booked).toMatchObject({ status: "scheduled", booking: { status: "confirmed", demo: true } });
      expect((await api("GET", "/api/bootstrap")).mode).toBe("demo");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
