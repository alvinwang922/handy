import { createHash } from "node:crypto";
import * as claude from "./claude";
import { config } from "./config";
import { bookingNeedsReconciliation, getQuoteRevision, isActionableQuote } from "./communications/approval";
import { buildProviderTarget, buildQuoteJob, validateQuoteResult } from "./communications/call-contract";
import * as dial from "./dial";
import { bookingInstruction } from "./instructions";
import * as keewano from "./keewano";
import * as parts from "./parts";
import { getProperty, getProvider, getRequest, listProviders, newId, nowIso, saveRequest, setStatus } from "./store";
import type { CallPurpose, CallRecord, PartSearch, Provider, ProviderScore, QuoteJob, RepairRequest, Trade } from "./types";

// Owner: Claude Code (glue). Drives the call lifecycle; every mutation runs under a per-request lock
// so the UI's 3s polling can never overwrite a concurrent outreach/booking write.

const ACTIVE = new Set(["Queued", "Ringing", "In-Progress"]);
const TRANSCRIPT_WAIT_MS = 60_000;
const MAX_EXTRACT_ATTEMPTS = 3;

// Kept on globalThis so all route handlers share one lock table in `next dev`.
const g = globalThis as unknown as { __handyLocks?: Map<string, Promise<unknown>>; __handyPartSearches?: Set<string> };
const locks = (g.__handyLocks ??= new Map());
const partSearches = (g.__handyPartSearches ??= new Set<string>());

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

// Ranks the trade's providers (Keewano history, falling back to ratings) and picks the top ones
// that this request hasn't called yet, so a retry after "nobody answered" reaches new providers.
export async function rankForRequest(req: RepairRequest): Promise<{ ranked: ProviderScore[]; providers: Provider[] }> {
  const pool = providersFor(req.diagnosis!.trade).filter((provider) => {
    const target = buildProviderTarget(provider);
    return target.serviceAreaMatch && target.contactVerified && target.trade === req.diagnosis!.trade;
  });
  const poolTrade = pool[0]?.trade ?? req.diagnosis!.trade;
  let ranked: ProviderScore[];
  try {
    ranked = (await keewano.rankProviders(poolTrade)).filter((s) => pool.some((p) => p.id === s.providerId));
    if (!ranked.length) throw new Error("no ranked providers");
  } catch (e) {
    req.notice = `Keewano ranking unavailable (${(e as Error).message}); using ratings.`;
    ranked = [...pool]
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
  const alreadyCalled = new Set(req.calls.filter((c) => c.purpose === "quote").map((c) => c.providerId));
  const providers = ranked
    .filter((s) => !alreadyCalled.has(s.providerId))
    .slice(0, Math.max(1, config.quoteFanout))
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

function newCall(providerId: string, purpose: CallPurpose, outboundInstruction: string, quoteJob: QuoteJob | null, id = newId("call")): CallRecord {
  return {
    id,
    dialCallId: null,
    providerId,
    purpose,
    dispatchState: "queued",
    idempotencyKey: quoteJob?.idempotencyKey ?? `handy:${purpose}:${id}`,
    outboundInstruction,
    quoteJob,
    state: "queued_local",
    terminationType: null,
    durationSec: null,
    transcript: null,
    transcriptStatus: "pending",
    transcriptTurns: [],
    transcriptHash: null,
    quote: null,
    quoteResult: null,
    booking: null,
    startedAt: null,
    endedAt: null,
    error: null,
    extractionStatus: "not_started",
    extractionError: null,
    extractAttempts: 0,
  };
}

export async function startQuoteCalls(req: RepairRequest, providers: Provider[]): Promise<RepairRequest> {
  const calls = providers.map((provider) => {
    const id = newId("call");
    const job = buildQuoteJob(req, provider, id);
    return newCall(provider.id, "quote", job.outboundInstruction, job, id);
  });
  req.calls.push(...calls);
  setStatus(req, "quoting");
  saveRequest(req); // Persist every immutable attempt before any external side effect.
  await pump(req);
  return saveRequest(req);
}

export async function startBookingCall(
  req: RepairRequest,
  providerId: string,
  slots: string[],
  accessNote: string,
): Promise<RepairRequest> {
  // Defense in depth for PRD principle 1: never place a booking call without a matching approval.
  if (req.approval?.providerId !== providerId) throw new Error("No approval recorded for this provider");
  if (bookingNeedsReconciliation(req)) throw new Error("Reconcile the previous booking call before calling again.");
  if (req.calls.some((call) => call.purpose === "booking" && (ACTIVE.has(call.state) || call.state === "queued_local"))) {
    throw new Error("A booking call is already pending.");
  }
  const approvedQuoteCall = req.calls.find((call) => call.id === req.approval?.quoteCallId);
  if (!approvedQuoteCall || approvedQuoteCall.providerId !== providerId || !isActionableQuote(approvedQuoteCall)) {
    throw new Error("Approval does not identify an actionable quote for this provider.");
  }
  if (req.approval.quoteRevision !== getQuoteRevision(approvedQuoteCall)) {
    throw new Error("The approved quote changed; review it again before booking.");
  }
  req.selectedProviderId = providerId;
  req.offeredSlots = slots;
  req.accessNote = accessNote;
  req.notice = null;
  const provider = getProvider(providerId);
  if (!provider) throw new Error("Unknown provider");
  const quote = approvedQuoteCall?.quote ?? null;
  const property = getProperty(req.propertyId);
  const access = `${property?.address ?? "address on file"}, ${req.unit}. ${req.accessNote || "Contact the property manager on arrival."}`;
  const instruction = bookingInstruction(provider, req.diagnosis!, quote, req.offeredSlots, access, config.companyName, approvedQuoteCall?.quoteResult?.feeTreatment);
  req.calls.push(newCall(providerId, "booking", instruction, null));
  setStatus(req, "booking");
  saveRequest(req);
  await pump(req);
  return saveRequest(req);
}

// Places queued calls while staying under MAX_CONCURRENT_CALLS (Dial free tier allows 2).
async function pump(req: RepairRequest) {
  let active = req.calls.filter((c) => ACTIVE.has(c.state)).length;
  for (const call of req.calls.filter((c) => c.state === "queued_local" && c.dispatchState === "queued")) {
    if (active >= config.maxConcurrentCalls) break;
    if (!call.outboundInstruction.trim() || (call.purpose === "quote" && !call.quoteJob)) {
      Object.assign(call, {
        dispatchState: "failed", state: "Terminated", terminationType: "failed", transcriptStatus: "unavailable",
        error: "This queued call lacks its frozen instructions or quote job. Review the repair and start fresh outreach.",
        endedAt: nowIso(),
      });
      saveRequest(req);
      continue;
    }
    const provider = getProvider(call.providerId);
    if (!provider) {
      Object.assign(call, { dispatchState: "failed", state: "Terminated", terminationType: "failed", transcriptStatus: "unavailable", error: "Unknown provider", endedAt: nowIso() });
      continue;
    }
    call.dispatchState = "dispatching";
    saveRequest(req);
    try {
      const { dialCallId } = await dial.placeCall({
        to: provider.phone,
        instruction: call.outboundInstruction,
        maxSec: call.purpose === "quote" ? config.quoteCallMaxSec : config.bookingCallMaxSec,
        idempotencyKey: call.idempotencyKey,
        purpose: call.purpose,
      });
      Object.assign(call, { dialCallId, dispatchState: "accepted", state: "Queued", startedAt: nowIso(), error: null });
      saveRequest(req);
      active++;
      if (call.purpose === "quote") void keewano.track({ kind: "provider", id: provider.id }, [{ name: "QuoteRequested" }]);
    } catch (e) {
      const status = e instanceof dial.DialError ? e.status : 0;
      const uncertain = !(e instanceof dial.DialError) || e.uncertain;
      call.dispatchState = uncertain ? "send_unknown" : "failed";
      call.error = uncertain ? "Call placement status is unknown; reconcile in Dial before retrying." : (e as Error).message;
      req.notice = `Couldn't call ${provider.name}: ${call.error}`;
      Object.assign(call, { state: "Terminated", terminationType: "failed", transcriptStatus: "unavailable", endedAt: nowIso() });
      saveRequest(req);
      // Out of credit / at the concurrency cap: stop placing the rest in this pass too.
      if (status === 402 || status === 429) break;
    }
  }
}

const transcriptTimedOut = (c: CallRecord) =>
  c.endedAt != null && Date.now() - Date.parse(c.endedAt) > TRANSCRIPT_WAIT_MS;

// The call is over and its transcript has arrived (or never will).
const settled = (c: CallRecord) =>
  c.state === "Terminated" && (c.terminationType !== "completed" || c.transcriptStatus === "ready" || c.transcriptStatus === "unavailable");

const hasResult = (c: CallRecord) => (c.purpose === "quote" ? c.quoteResult !== null || c.quote !== null : c.booking !== null);

// A transcript is waiting to be read and we still have extraction attempts left.
const extractionPending = (c: CallRecord) =>
  c.state === "Terminated" && c.transcriptStatus === "ready" && c.transcript !== null && !hasResult(c) && c.extractAttempts < MAX_EXTRACT_ATTEMPTS;

// Polls Dial for every unsettled call, extracts (and retries extracting) quotes/bookings once
// transcripts land, places queued calls as capacity frees up, then advances the request status.
export async function refresh(id: string): Promise<RepairRequest | null> {
  const req = getRequest(id);
  if (!req) return null;
  for (const call of req.calls) {
    if (call.state === "queued_local" && call.dispatchState === "dispatching" && !call.dialCallId) {
      Object.assign(call, {
        dispatchState: "send_unknown",
        state: "Terminated",
        terminationType: "failed",
        transcriptStatus: "unavailable",
        endedAt: nowIso(),
        error: "Recovered an interrupted dispatch; reconcile in Dial before retrying.",
      });
    }
    if (call.dialCallId && !settled(call)) {
      try {
        const snap = await dial.getCall(call.dialCallId);
        const justEnded = snap.state === "Terminated" && call.state !== "Terminated";
        Object.assign(call, { state: snap.state, terminationType: snap.terminationType, durationSec: snap.durationSec });
        if (justEnded) {
          call.endedAt = nowIso();
          if (call.purpose === "quote") {
            void keewano.track({ kind: "provider", id: call.providerId }, [
              { name: snap.terminationType === "completed" ? "CallAnswered" : "CallMissed" },
            ]);
          }
        }
        if (snap.transcript) {
          call.transcript = snap.transcript;
          call.transcriptTurns = snap.transcriptTurns;
          call.transcriptHash = createHash("sha256").update(snap.transcript).digest("hex");
          call.transcriptStatus = "ready";
        } else if (snap.state === "Terminated" && snap.terminationType !== "completed") {
          call.transcriptStatus = "unavailable";
        } else if (snap.state === "Terminated" && transcriptTimedOut(call)) {
          call.transcriptStatus = "unavailable";
        }
      } catch (e) {
        call.error = (e as Error).message;
      }
    }
    if (extractionPending(call)) await extract(req, call);
  }
  await pump(req);
  advanceStatus(req);
  return saveRequest(req);
}

async function extract(req: RepairRequest, call: CallRecord) {
  call.extractAttempts += 1;
  call.extractionStatus = "pending";
  call.extractionError = null;
  // The source and attempt survive a model failure or process interruption independently of extraction.
  saveRequest(req);
  try {
    if (call.purpose === "quote") {
      if (!call.quoteJob || !call.dialCallId) throw new Error("Quote call is missing its frozen job or Dial call ID.");
      const source = {
        dialCallId: call.dialCallId,
        direction: "outbound" as const,
        terminationType: call.terminationType,
        transcript: call.transcript!,
        turns: call.transcriptTurns,
      };
      const raw = await claude.extractQuote({
        requestId: req.id,
        briefVersion: call.quoteJob.briefVersion,
        providerId: call.providerId,
        dialCallId: call.dialCallId,
        transcript: call.transcript!,
        transcriptTurns: call.transcriptTurns,
        diagnosis: req.diagnosis!,
      });
      call.quoteResult = validateQuoteResult(raw, call.quoteJob, source);
      call.quote = {
        ...call.quoteResult.quote,
        outcome: call.quoteResult.outcome,
        collectionStatus: call.quoteResult.collectionStatus,
        uncollectedFields: call.quoteResult.uncollectedFields,
        feeTreatment: call.quoteResult.feeTreatment,
        missingInformation: call.quoteResult.missingInformation,
        quoteBasis: call.quoteResult.quoteBasis,
        photoReviewState: call.quoteResult.photoReviewState,
        evidence: call.quoteResult.evidence,
      };
      call.quoteRevision = getQuoteRevision(call);
      if (call.quote.priceLowUsd != null) {
        void keewano.track({ kind: "provider", id: call.providerId }, [
          { name: "QuotePriceCents", value: Math.round(call.quote.priceLowUsd * 100) },
        ]);
      }
    } else {
      call.booking = await claude.extractBooking({ transcript: call.transcript!, offeredSlots: req.offeredSlots });
    }
    call.extractionStatus = "validated";
    call.extractionError = null;
    call.error = null;
  } catch (e) {
    call.extractionStatus = "failed";
    call.extractionError = `Extraction attempt ${call.extractAttempts}/${MAX_EXTRACT_ATTEMPTS} failed: ${(e as Error).message}`;
  }
}

function advanceStatus(req: RepairRequest) {
  if (req.status === "quoting") {
    const quoteCalls = req.calls.filter((c) => c.purpose === "quote");
    if (!quoteCalls.every((c) => settled(c) && !extractionPending(c))) return;
    if (quoteCalls.some(isActionableQuote)) {
      setStatus(req, "quotes_ready");
    } else {
      req.notice = quoteCalls.some((call) => call.dispatchState === "send_unknown")
        ? "A call's placement is unknown. Reconcile it in Dial before retrying; no actionable quote is available yet."
        : "No provider gave an actionable quote. Review any requested information or start outreach again to try the next providers.";
      setStatus(req, "failed");
    }
    return;
  }

  if (req.status === "booking") {
    const booking = req.calls.filter((c) => c.purpose === "booking").at(-1);
    if (!booking || !settled(booking)) return;
    if (extractionPending(booking)) {
      // Never fall back to "not confirmed" while the transcript is still being read: that would
      // invite a second booking call to a provider who may already have said yes.
      req.notice = "Booking call ended; reading the result…";
      return;
    }
    if (bookingNeedsReconciliation(req)) {
      req.notice = "The booking outcome is unverified. Reconcile the call and transcript before making another booking call.";
      return;
    }
    if (booking.booking?.confirmed && booking.extractionStatus === "validated") {
      if (!booking.booking.slot) {
        req.notice = "The provider's confirmed time is missing. Reconcile the booking transcript before calling again.";
        return;
      }
      req.scheduledSlot = booking.booking.slot;
      req.notice = null;
      setStatus(req, "scheduled");
      const minutesToBook = Math.round((Date.now() - Date.parse(req.createdAt)) / 60000);
      void keewano.track({ kind: "request", id: req.id }, [
        { name: "MinutesToBook", value: minutesToBook },
        { name: "UserActiveSec", value: Math.round(req.userActiveSec) },
      ]);
      void keewano.track({ kind: "provider", id: booking.providerId }, [{ name: "JobBooked" }]);
      return;
    }
    req.notice = booking.terminationType === "failed" && booking.error
      ? `Booking call failed: ${booking.error}`
      : booking.terminationType !== "completed"
        ? `Booking call ${booking.terminationType ?? "ended"}: the provider didn't pick up. Try again or choose another provider.`
        : booking.booking === null
          ? "Couldn't read the booking call. Check the transcript before calling again."
          : "The provider didn't confirm a time. Pick other windows or another provider.";
    setStatus(req, "quotes_ready");
  }
}

// ---- DIY part search ---------------------------------------------------------------------

// True while this process is searching for the request. A stored "searching" status with no running
// search (e.g. after a dev-server restart) is stale, and the retry route may start a new one.
export const isPartSearchRunning = (id: string) => partSearches.has(id);

// Runs the part-search agent (web search, up to ~1 min) outside the lock so polls and outreach aren't
// blocked, then stores the result under the lock. Never throws: failures are saved as status "failed".
export async function searchPartsForRequest(id: string): Promise<void> {
  const diagnosis = getRequest(id)?.diagnosis;
  const part = diagnosis?.fixPath === "diy" ? diagnosis.diyPlan?.parts[0] : undefined;
  if (!diagnosis || !part || partSearches.has(id)) return;
  partSearches.add(id);
  try {
    let result: PartSearch;
    try {
      result = await parts.findPartOptions({ diagnosis, part });
    } catch (e) {
      result = {
        ...parts.searchingPartSearch(part.name),
        status: "failed",
        searchedAt: nowIso(),
        error: `Part search failed: ${(e as Error).message}`,
      };
    }
    await withLock(id, async () => {
      const fresh = getRequest(id);
      if (!fresh) return;
      fresh.partSearch = result;
      saveRequest(fresh);
    });
  } catch (e) {
    console.error(`[parts] couldn't store the part search for ${id}:`, e);
  } finally {
    partSearches.delete(id);
  }
}
