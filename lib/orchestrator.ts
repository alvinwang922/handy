import * as claude from "./claude";
import { config } from "./config";
import * as dial from "./dial";
import { bookingInstruction, quoteInstruction } from "./instructions";
import * as keewano from "./keewano";
import { getProperty, getProvider, getRequest, listProviders, newId, nowIso, saveRequest, setStatus } from "./store";
import type { CallPurpose, CallRecord, Provider, ProviderScore, RepairRequest, Trade } from "./types";

// Owner: Claude Code (glue). Drives the call lifecycle; every mutation runs under a per-request lock
// so the UI's 3s polling can never overwrite a concurrent outreach/booking write.

const ACTIVE = new Set(["Queued", "Ringing", "In-Progress"]);
const TRANSCRIPT_WAIT_MS = 60_000;
const QUOTE_FANOUT = 3;

// Kept on globalThis so all route handlers share one lock table in `next dev`.
const g = globalThis as unknown as { __handyLocks?: Map<string, Promise<unknown>> };
const locks = (g.__handyLocks ??= new Map());

export async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}

export const isLocked = (id: string) => locks.has(id);

// ---- Provider selection ------------------------------------------------------------------

export async function rankForRequest(req: RepairRequest): Promise<{ ranked: ProviderScore[]; providers: Provider[] }> {
  const trade = req.diagnosis!.trade;
  const pool = providersFor(trade);
  let ranked: ProviderScore[];
  try {
    ranked = (await keewano.rankProviders(trade)).filter((s) => pool.some((p) => p.id === s.providerId));
    if (!ranked.length) throw new Error("no ranked providers");
  } catch (e) {
    req.notice = `Keewano ranking unavailable (${(e as Error).message}); using ratings.`;
    ranked = pool
      .sort((a, b) => b.rating - a.rating)
      .map((p) => ({
        providerId: p.id,
        score: Math.round(p.rating * 20),
        answerRate: 0,
        onTimeRate: 0,
        quoteAccuracyPct: 100,
        reason: `Rated ${p.rating} (${p.reviewCount} reviews)`,
      }));
  }
  const providers = ranked
    .slice(0, QUOTE_FANOUT)
    .map((s) => pool.find((p) => p.id === s.providerId)!)
    .filter(Boolean);
  return { ranked, providers };
}

function providersFor(trade: Trade): Provider[] {
  const all = listProviders();
  const match = all.filter((p) => p.trade === trade);
  return match.length ? match : all.filter((p) => p.trade === "handyman");
}

// ---- Call lifecycle ----------------------------------------------------------------------

function newCall(providerId: string, purpose: CallPurpose): CallRecord {
  return {
    id: newId("call"),
    dialCallId: null,
    providerId,
    purpose,
    state: "queued_local",
    terminationType: null,
    durationSec: null,
    transcript: null,
    quote: null,
    booking: null,
    startedAt: null,
    endedAt: null,
    error: null,
  };
}

export async function startQuoteCalls(req: RepairRequest, providers: Provider[]): Promise<RepairRequest> {
  req.calls.push(...providers.map((p) => newCall(p.id, "quote")));
  setStatus(req, "quoting");
  await pump(req);
  return saveRequest(req);
}

export async function startBookingCall(
  req: RepairRequest,
  providerId: string,
  slots: string[],
  accessNote: string,
): Promise<RepairRequest> {
  req.selectedProviderId = providerId;
  req.offeredSlots = slots;
  req.accessNote = accessNote;
  req.notice = null;
  req.calls.push(newCall(providerId, "booking"));
  setStatus(req, "booking");
  await pump(req);
  return saveRequest(req);
}

// Places queued calls while staying under MAX_CONCURRENT_CALLS (Dial free tier allows 2).
async function pump(req: RepairRequest) {
  let active = req.calls.filter((c) => ACTIVE.has(c.state)).length;
  for (const call of req.calls.filter((c) => c.state === "queued_local")) {
    if (active >= config.maxConcurrentCalls) break;
    const provider = getProvider(call.providerId);
    if (!provider) {
      Object.assign(call, { state: "Terminated", terminationType: "failed", error: "Unknown provider" });
      continue;
    }
    try {
      const { dialCallId } = await dial.placeCall({
        to: provider.phone,
        instruction: instructionFor(req, call, provider),
        maxSec: call.purpose === "quote" ? config.quoteCallMaxSec : config.bookingCallMaxSec,
        purpose: call.purpose,
      });
      Object.assign(call, { dialCallId, state: "Queued", startedAt: nowIso(), error: null });
      active++;
      if (call.purpose === "quote") void keewano.track({ kind: "provider", id: provider.id }, [{ name: "QuoteRequested" }]);
    } catch (e) {
      const status = e instanceof dial.DialError ? e.status : 0;
      call.error = (e as Error).message;
      req.notice = `Couldn't call ${provider.name}: ${call.error}`;
      // Out of credit / concurrency cap: leave it queued and retry on the next refresh.
      if (status === 402 || status === 429) break;
      Object.assign(call, { state: "Terminated", terminationType: "failed" });
    }
  }
}

function instructionFor(req: RepairRequest, call: CallRecord, provider: Provider): string {
  if (call.purpose === "quote") return quoteInstruction(provider, req.diagnosis!, req.unitInsight, config.companyName);
  const quote = req.calls.find((c) => c.purpose === "quote" && c.providerId === provider.id)?.quote ?? null;
  const property = getProperty(req.propertyId);
  const access = `${property?.address ?? "address on file"}, ${req.unit}. ${req.accessNote || "Contact the property manager on arrival."}`;
  return bookingInstruction(provider, req.diagnosis!, quote, req.offeredSlots, access, config.companyName);
}

const transcriptTimedOut = (c: CallRecord) =>
  c.endedAt != null && Date.now() - Date.parse(c.endedAt) > TRANSCRIPT_WAIT_MS;

const settled = (c: CallRecord) =>
  c.state === "Terminated" && (c.terminationType !== "completed" || c.transcript !== null || transcriptTimedOut(c));

// Polls Dial for every unsettled call, extracts quotes/bookings once transcripts land, places
// queued calls as capacity frees up, then advances the request status.
export async function refresh(id: string): Promise<RepairRequest | null> {
  const req = getRequest(id);
  if (!req) return null;
  for (const call of req.calls) {
    if (!call.dialCallId || settled(call)) continue;
    let snap: dial.CallSnapshot;
    try {
      snap = await dial.getCall(call.dialCallId);
    } catch (e) {
      call.error = (e as Error).message;
      continue;
    }
    const justEnded = snap.state === "Terminated" && call.state !== "Terminated";
    Object.assign(call, { state: snap.state, terminationType: snap.terminationType, durationSec: snap.durationSec });
    if (justEnded) {
      call.endedAt = nowIso();
      if (call.purpose === "quote") {
        void keewano.track({ kind: "provider", id: call.providerId }, [
          { name: "CallAnswered", value: snap.terminationType === "completed" },
        ]);
      }
    }
    if (snap.transcript && !call.transcript) {
      call.transcript = snap.transcript;
      await extract(req, call);
    }
  }
  await pump(req);
  advanceStatus(req);
  return saveRequest(req);
}

async function extract(req: RepairRequest, call: CallRecord) {
  try {
    if (call.purpose === "quote") {
      call.quote = await claude.extractQuote({ transcript: call.transcript!, diagnosis: req.diagnosis! });
      if (call.quote.priceLowUsd != null) {
        void keewano.track({ kind: "provider", id: call.providerId }, [
          { name: "QuotePriceCents", value: Math.round(call.quote.priceLowUsd * 100) },
        ]);
      }
    } else {
      call.booking = await claude.extractBooking({ transcript: call.transcript!, offeredSlots: req.offeredSlots });
    }
  } catch (e) {
    call.error = `Extraction failed: ${(e as Error).message}`;
  }
}

function advanceStatus(req: RepairRequest) {
  if (req.status === "quoting" && req.calls.filter((c) => c.purpose === "quote").every(settled)) {
    setStatus(req, "quotes_ready");
  }
  if (req.status === "booking") {
    const booking = req.calls.filter((c) => c.purpose === "booking").at(-1);
    if (!booking || !settled(booking)) return;
    if (booking.booking?.confirmed) {
      req.scheduledSlot = booking.booking.slot;
      setStatus(req, "scheduled");
      const minutesToBook = Math.round((Date.now() - Date.parse(req.createdAt)) / 60000);
      void keewano.track({ kind: "request", id: req.id }, [
        { name: "MinutesToBook", value: minutesToBook },
        { name: "UserActiveSec", value: Math.round(req.userActiveSec) },
      ]);
      void keewano.track({ kind: "provider", id: booking.providerId }, [{ name: "JobBooked" }]);
    } else {
      req.notice = "The provider didn't confirm a time. Pick other windows or another provider.";
      setStatus(req, "quotes_ready");
    }
  }
}
