// Controlled agent-to-agent acceptance only. Never use this harness for a real business appointment.
import fs from "node:fs";
import path from "node:path";
import { DialClient } from "@getdial/sdk";
import { extractQuote } from "../lib/claude";
import { config } from "../lib/config";
import { getQuoteRevision } from "../lib/communications/approval";
import { validateQuoteResult } from "../lib/communications/call-contract";
import { getProvider, getRequest, listRequests, nowIso, saveRequest } from "../lib/store";
import type { RepairRequest } from "../lib/types";

class SmokeError extends Error {}
const emit = (event: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: nowIso(), event, ...details }));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const providerId = "plumb_rooter";
const overridesPath = path.resolve("data/providers.local.json");
// Shared journal/lock with smoke-live-quote.ts; its --recover also understands this record.
const recoveryPath = path.resolve("data/live-smoke-restore.local.json");
const slots = ["October 13, 2026, 9–11 AM Pacific", "October 14, 2026, 1–3 PM Pacific"];

interface Recovery {
  schemaVersion: 1;
  requestId: string;
  providerNumberId: string;
  inboundInstruction: string;
  previousOverrides: string | null;
  createdAt: string;
}

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new SmokeError(`Missing ${name}.`);
  return value;
};

function readRecovery(): Recovery {
  const record = JSON.parse(fs.readFileSync(recoveryPath, "utf8")) as Partial<Recovery>;
  if (record.schemaVersion !== 1 || !record.requestId?.startsWith("req_live_")
    || typeof record.providerNumberId !== "string" || typeof record.inboundInstruction !== "string"
    || !(record.previousOverrides === null || typeof record.previousOverrides === "string")) {
    throw new SmokeError("Invalid restoration journal; preserve it for manual recovery.");
  }
  return record as Recovery;
}

async function restore(client: DialClient, recovery: Recovery) {
  let personaRestored = false;
  let overridesRestored = false;
  try {
    await client.setNumberProperties(recovery.providerNumberId, { inboundInstruction: recovery.inboundInstruction });
    const receiver = (await client.listNumbers()).find((number) => number.id === recovery.providerNumberId);
    personaRestored = Boolean(receiver) && (receiver?.inboundInstruction ?? "") === recovery.inboundInstruction;
  } catch { /* Local restoration must still run if Dial is unavailable. */ }
  finally {
    try {
      if (recovery.previousOverrides === null) {
        fs.rmSync(overridesPath, { force: true });
        overridesRestored = !fs.existsSync(overridesPath);
      } else {
        const bytes = Buffer.from(recovery.previousOverrides, "base64");
        fs.writeFileSync(overridesPath, bytes, { mode: 0o600 });
        fs.chmodSync(overridesPath, 0o600);
        overridesRestored = fs.readFileSync(overridesPath).equals(bytes);
      }
    } catch { /* Retain the journal to retry safely. */ }
  }
  emit("restoration_checked", { personaRestored, overridesRestored });
  if (!personaRestored || !overridesRestored) throw new SmokeError("Restoration is incomplete; the private journal remains. Run --recover before another test.");
  fs.rmSync(recoveryPath);
}

function appUrl() {
  const url = new URL(process.env.HANDY_APP_URL ?? "http://127.0.0.1:3000");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new SmokeError("HANDY_APP_URL must be a plain local HTTP origin for this same checkout/data directory.");
  }
  return url.origin;
}

async function endpoint(origin: string, requestId: string, bookingBody?: unknown): Promise<RepairRequest> {
  let response: Response;
  try {
    response = await fetch(`${origin}/api/requests/${encodeURIComponent(requestId)}${bookingBody ? "/book" : ""}`, {
      method: bookingBody ? "POST" : "GET",
      headers: bookingBody ? { "Content-Type": "application/json" } : undefined,
      body: bookingBody ? JSON.stringify(bookingBody) : undefined,
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });
  } catch {
    throw new SmokeError(bookingBody ? "Booking POST outcome is unknown; inspect the persisted attempt. Do not repeat approval automatically." : "Local request endpoint was unavailable.");
  }
  if (!response.ok) throw new SmokeError(`Local ${bookingBody ? "booking" : "request"} endpoint returned HTTP ${response.status}; inspect private local state.`);
  const request = await response.json() as RepairRequest;
  if (request.id !== requestId || !Array.isArray(request.calls)) throw new SmokeError("Local endpoint returned an unexpected request.");
  return request;
}

function selectedRequest(args: string[]) {
  const suppliedId = args.find((arg) => arg.startsWith("--request-id="))?.slice("--request-id=".length);
  if (suppliedId && !/^req_live_[a-z0-9-]+$/.test(suppliedId)) throw new SmokeError("Only an existing controlled req_live_ request is accepted.");
  const request = suppliedId ? getRequest(suppliedId) : listRequests()
    .filter((candidate) => candidate.id.startsWith("req_live_") && candidate.title === "Controlled sink drain quote test")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!request || request.title !== "Controlled sink drain quote test") throw new SmokeError("Run the controlled live quote test first; no fixture quote fallback is allowed.");
  return request;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node --env-file=.env.local --import tsx scripts/smoke-live-booking.ts --approve [--request-id=req_live_...]\nRequires HANDY_LIVE_DEMO=1, MOCK_DIAL=0, MOCK_CLAUDE=0, MOCK_CLAUDE_EXTRACT=0, local app from this checkout with matching settings. --recover restores private state. --observe polls an already dispatched booking only. --approve authorizes a fictional controlled agent-to-agent appointment, never real work.");
    return;
  }
  if (args.some((arg) => !["--approve", "--recover", "--observe"].includes(arg) && !arg.startsWith("--request-id="))
    || args.filter((arg) => ["--approve", "--recover", "--observe"].includes(arg)).length !== 1) {
    throw new SmokeError("Choose exactly one of --approve, --recover or --observe; see --help.");
  }
  if (process.env.HANDY_LIVE_DEMO !== "1") throw new SmokeError("Set HANDY_LIVE_DEMO=1 for this controlled test.");
  const providerNumberId = required("DIAL_RECEPTIONIST_NUMBER_ID");
  const coordinatorId = required("DIAL_FROM_NUMBER_ID");
  if (providerNumberId === coordinatorId) throw new SmokeError("Caller and receiver must be distinct controlled numbers.");
  const client = new DialClient({ apiKey: required("DIAL_API_KEY"), userAgent: "handy-booking-smoke/0.1" });
  if (args.includes("--recover")) {
    if (!fs.existsSync(recoveryPath)) throw new SmokeError("No test restoration journal exists.");
    const recovery = readRecovery();
    if (recovery.providerNumberId !== providerNumberId) throw new SmokeError("Restoration journal belongs to another controlled receiver.");
    await restore(client, recovery);
    return;
  }
  if (config.mockDial || config.mockClaudeExtract) throw new SmokeError("Live booking requires live Dial and production quote/booking extraction.");
  const origin = appUrl();
  const request = selectedRequest(args);
  if (request.calls.some((call) => call.state === "queued_local")) throw new SmokeError("A queued attempt exists; this test will not dispatch it through observation.");
  if (args.includes("--observe")) {
    if (!request.calls.some((call) => call.purpose === "booking" && call.dialCallId)) throw new SmokeError("No dispatched booking exists to observe.");
    const updated = await endpoint(origin, request.id);
    const call = updated.calls.filter((item) => item.purpose === "booking").at(-1);
    emit("booking_observed", { requestId: request.id, status: updated.status, state: call?.state, extractionStatus: call?.extractionStatus, outcome: call?.booking?.outcome, confirmed: call?.booking?.confirmed });
    return;
  }
  if (fs.existsSync(recoveryPath)) throw new SmokeError("Recover the previous controlled test before starting another.");
  if (request.calls.some((call) => call.purpose === "booking" || call.state !== "Terminated")) throw new SmokeError("This request already has a booking attempt or unfinished call; observe/reconcile it instead of redialing.");
  const quoteCall = request.calls.filter((call) => call.providerId === providerId && call.purpose === "quote"
    && call.terminationType === "completed" && call.dialCallId && !call.dialCallId.startsWith("mock_")
    && call.transcript && call.transcriptTurns.length && call.quoteJob).at(-1);
  if (!quoteCall?.quoteJob || !quoteCall.dialCallId || !quoteCall.transcript || !request.diagnosis) {
    throw new SmokeError("A completed controlled live quote with source evidence is required.");
  }
  const numbers = await client.listNumbers();
  const coordinator = numbers.find((number) => number.id === coordinatorId);
  const receiver = numbers.find((number) => number.id === providerNumberId);
  if (!coordinator?.callingEnabled || !receiver?.callingEnabled) throw new SmokeError("Both configured numbers must belong to this account and support voice.");
  if ((await client.listCalls()).some((call) => [coordinatorId, providerNumberId].includes(call.phoneNumberId)
    && ["Queued", "Ringing", "In-Progress"].includes(call.status.state))) throw new SmokeError("A controlled test line is already in use.");
  if (config.bookingCallMaxSec > 180) throw new SmokeError("Set BOOKING_CALL_MAX_SEC to at most 180 for this acceptance test.");

  // Re-read the saved real quote using production extraction; do not carry forward a mock parser mistake.
  const extracted = await extractQuote({
    requestId: request.id, briefVersion: quoteCall.quoteJob.briefVersion, providerId,
    dialCallId: quoteCall.dialCallId, transcript: quoteCall.transcript, transcriptTurns: quoteCall.transcriptTurns,
    diagnosis: quoteCall.quoteJob.brief?.diagnosis ?? request.diagnosis,
    referenceAt: quoteCall.quoteJob.brief?.referenceAt ?? request.createdAt,
    timeZone: quoteCall.quoteJob.brief?.serviceArea.timeZone ?? config.propertyTimeZone,
  });
  const result = validateQuoteResult(extracted, quoteCall.quoteJob, {
    dialCallId: quoteCall.dialCallId, direction: "outbound", terminationType: quoteCall.terminationType,
    transcript: quoteCall.transcript, turns: quoteCall.transcriptTurns,
  });
  if (result.extractionMethod !== "model" || result.outcome !== "quote_received" || result.quote.pricingType !== "flat"
    || result.quote.priceLowUsd !== 220 || (result.quote.priceHighUsd !== null && result.quote.priceHighUsd !== 220) || result.quote.visitFeeUsd !== 0) {
    throw new SmokeError("Production extraction did not verify the controlled $220 flat/no-fee quote; no booking was sent.");
  }
  quoteCall.quoteResult = result;
  quoteCall.quote = { ...result.quote, outcome: result.outcome, feeTreatment: result.feeTreatment,
    collectionStatus: result.collectionStatus, uncollectedFields: result.uncollectedFields, evidence: result.evidence };
  quoteCall.quoteRevision = getQuoteRevision(quoteCall);
  quoteCall.extractionStatus = "validated";
  quoteCall.extractionError = null;
  request.status = "quotes_ready";
  saveRequest(request);
  emit("live_quote_revalidated", { requestId: request.id, extractionMethod: result.extractionMethod, amountUsd: 220, visitFeeUsd: 0 });

  const recovery: Recovery = {
    schemaVersion: 1, requestId: request.id, providerNumberId, inboundInstruction: receiver.inboundInstruction ?? "",
    previousOverrides: fs.existsSync(overridesPath) ? fs.readFileSync(overridesPath).toString("base64") : null,
    createdAt: nowIso(),
  };
  fs.writeFileSync(recoveryPath, JSON.stringify(recovery, null, 2), { mode: 0o600, flag: "wx" });
  try {
    fs.writeFileSync(overridesPath, JSON.stringify({ [providerId]: receiver.number }), { mode: 0o600 });
    fs.chmodSync(overridesPath, 0o600);
    if (getProvider(providerId)?.phone !== receiver.number) throw new SmokeError("Controlled receiver mapping failed.");
    await client.setNumberProperties(providerNumberId, { inboundInstruction: [
      "You are the AI receptionist for a fictional plumbing company in an authorized agent-to-agent acceptance test. Disclose you are an AI receptionist. No real work or visit will occur.",
      "The caller is Handy booking the previously quoted sink-drain repair. Answer concisely and proactively: Yes, I confirm the appointment for October 13, 2026, 9 to 11 AM Pacific.",
      "Confirm that the approved $220 flat estimate is unchanged, including labor and standard fittings, with no visit fee. The same sink-drain repair scope and existing conditions remain unchanged. Any extra work needs new approval.",
      "State these terms and the date clearly. Accept the offered synthetic address/access details only for the fictional test. Confirm the caller's readback, say goodbye and end the call promptly. No deposits or payment.",
    ].join("\n") });
    const readback = (await client.listNumbers()).find((number) => number.id === providerNumberId);
    if (!readback?.inboundInstruction?.includes("authorized agent-to-agent acceptance test")) throw new SmokeError("Controlled booking persona did not verify.");
    const visible = await endpoint(origin, request.id);
    if (visible.calls.find((call) => call.id === quoteCall.id)?.quoteRevision !== quoteCall.quoteRevision) {
      throw new SmokeError("Local backend does not see this checkout's revalidated quote; no booking sent.");
    }
    emit("controlled_booking_approved", { requestId: request.id, amountUsd: 220, allowedWindows: slots.length, realWorkAuthorized: false });
    await endpoint(origin, request.id, {
      providerId, quoteCallId: quoteCall.id, quoteRevision: quoteCall.quoteRevision, slots,
      accessNote: "Fictional controlled test only. No actual visit, work, payment or property access is authorized.",
      consentText: "Explicit --approve for one fictional agent-to-agent booking acceptance test at the verified $220 flat estimate, no fee, within either supplied window. No real work authorized.",
    });
    const deadline = Date.now() + 300_000;
    let priorState = "";
    while (Date.now() < deadline) {
      const updated = await endpoint(origin, request.id);
      const booking = updated.calls.filter((call) => call.purpose === "booking").at(-1);
      if (!booking) throw new SmokeError("Booking endpoint did not persist its attempt.");
      const state = `${booking.dispatchState}/${booking.state}/${booking.extractionStatus}`;
      if (state !== priorState) { emit("booking_state", { requestId: request.id, state }); priorState = state; }
      if (updated.status === "scheduled" && booking.booking?.confirmed && booking.extractionStatus === "validated") {
        if (!booking.booking.slot || !slots.includes(booking.booking.slot) || booking.booking.termsUnchanged !== true) throw new SmokeError("Booking confirmation did not match the approved test windows/terms.");
        emit("booking_smoke_passed", { requestId: request.id, endpointValidated: true, confirmed: true, termsUnchanged: true,
          durationSec: booking.durationSec, evidenceCount: booking.booking.evidence?.length ?? 0, fictionalAppointment: true });
        return;
      }
      if (booking.dispatchState === "send_unknown" || booking.dispatchState === "failed"
        || (booking.state === "Terminated" && updated.status === "quotes_ready")) throw new SmokeError("The controlled booking was not confirmed; inspect saved evidence before another attempt.");
      await delay(5_000);
    }
    throw new SmokeError("Timed out waiting for booking confirmation; preserve/reconcile the existing attempt.");
  } finally {
    try {
      const active = getRequest(request.id)?.calls.filter((call) => call.purpose === "booking" && call.dialCallId && call.state !== "Terminated") ?? [];
      for (const call of active) await client.stopCall(call.dialCallId!).catch(() => emit("call_stop_unconfirmed"));
    } finally { await restore(client, recovery); }
  }
}

void main().catch((error: unknown) => {
  emit("booking_smoke_failed", { message: error instanceof SmokeError ? error.message : "Controlled booking test failed. Inspect private local state; raw API details were omitted." });
  process.exitCode = 1;
});
