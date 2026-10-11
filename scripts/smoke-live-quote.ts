import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DialClient } from "@getdial/sdk";
import { getProvider, getRequest, listRequests, nowIso, saveRequest } from "../lib/store";
import { refresh, startQuoteCalls } from "../lib/orchestrator";
import type { RepairRequest } from "../lib/types";
import { buildRepairPacket } from "../lib/communications/packet";
import type { MessageDeliveryState, PhotoReviewState } from "../lib/communications/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const emit = (event: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));
const dataDir = path.resolve("data");
const providerOverridesPath = path.join(dataDir, "providers.local.json");
const restorePath = path.join(dataDir, "live-smoke-restore.local.json");

class SmokeError extends Error {}

interface PhotoSendResult {
  messageId: string;
  dialMessageId: string | null;
  dispatchState: string;
  deliveryState: MessageDeliveryState;
  photoReviewState: PhotoReviewState;
  mode: "live" | "mock";
}

function localAppUrl(): URL {
  const url = new URL(required("HANDY_APP_URL"));
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new SmokeError("HANDY_APP_URL must be a local HTTP origin for the same checkout.");
  }
  return url;
}

function approvedPhotoPath(): string | null {
  const argument = process.argv.find((value) => value.startsWith("--photo="));
  if (!argument) return null;
  const photoPath = fs.realpathSync(path.resolve(argument.slice("--photo=".length)));
  const uploadRoot = fs.realpathSync(path.join(dataDir, "uploads"));
  const relative = path.relative(uploadRoot, photoPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !fs.statSync(photoPath).isFile()) {
    throw new SmokeError("--photo must be an approved JPEG/PNG file inside this checkout's data/uploads directory.");
  }
  return path.relative(process.cwd(), photoPath);
}

async function sendPhotoDuringCall(request: RepairRequest, providerId: string, callId: string): Promise<PhotoSendResult> {
  const origin = localAppUrl();
  const route = `/api/requests/${encodeURIComponent(request.id)}`;
  const previewResponse = await fetch(new URL(`${route}/packet?providerId=${encodeURIComponent(providerId)}`, origin), {
    signal: AbortSignal.timeout(15_000),
  });
  const preview = await previewResponse.json() as { requestId?: string; packetVersion?: string; canSend?: boolean };
  const localPacket = buildRepairPacket(request);
  if (!previewResponse.ok || !preview.canSend || preview.requestId !== request.id || preview.packetVersion !== localPacket.packetVersion) {
    throw new SmokeError("The local server did not approve the exact saved photo packet; nothing was sent.");
  }
  // One request, one stable key. A timeout is uncertain and must not automatically resend.
  const response = await fetch(new URL(`${route}/share-packet`, origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `handy-smoke:${request.id}:${preview.packetVersion}` },
    body: JSON.stringify({ providerId, packetVersion: preview.packetVersion, callId }),
    signal: AbortSignal.timeout(30_000),
  });
  const sent = await response.json() as Partial<PhotoSendResult> & { id?: string };
  if (!sent.id || !sent.dispatchState || !sent.deliveryState || !sent.photoReviewState || !sent.mode) {
    throw new SmokeError("Photo endpoint did not return a valid send record; inspect private message state before retrying.");
  }
  const result: PhotoSendResult = {
    messageId: sent.id, dialMessageId: sent.dialMessageId ?? null, dispatchState: sent.dispatchState,
    deliveryState: sent.deliveryState, photoReviewState: sent.photoReviewState, mode: sent.mode,
  };
  emit("photo_message_result", { requestId: request.id, ...result });
  return result;
}

interface RecoveryRecord {
  schemaVersion: 1;
  requestId: string;
  providerNumberId: string;
  inboundInstruction: string;
  previousOverrides: string | null; // Base64 preserves the exact previous private file.
  createdAt: string;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new SmokeError(`Missing ${name}.`);
  return value;
}

function writePrivate(file: string, value: unknown, exclusive = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600, flag: exclusive ? "wx" : "w" });
  fs.chmodSync(file, 0o600);
}

function readRecovery(): RecoveryRecord {
  const record: unknown = JSON.parse(fs.readFileSync(restorePath, "utf8"));
  if (!record || typeof record !== "object") throw new SmokeError("The recovery record is invalid; preserve it for manual recovery.");
  const value = record as Partial<RecoveryRecord>;
  if (value.schemaVersion !== 1 || typeof value.requestId !== "string" || !/^req_live_[a-z0-9-]+$/.test(value.requestId)
    || typeof value.providerNumberId !== "string" || typeof value.inboundInstruction !== "string"
    || !(typeof value.previousOverrides === "string" || value.previousOverrides === null)) {
    throw new SmokeError("The recovery record lacks the saved request or provider overrides; preserve it for manual recovery.");
  }
  return value as RecoveryRecord;
}

async function restore(client: DialClient, record: RecoveryRecord): Promise<void> {
  let personaRestored = false;
  let overridesRestored = false;
  try {
    await client.setNumberProperties(record.providerNumberId, { inboundInstruction: record.inboundInstruction });
    const restored = (await client.listNumbers()).find((number) => number.id === record.providerNumberId);
    personaRestored = restored?.inboundInstruction === record.inboundInstruction;
  } catch {
    // Continue restoring the independent local override even when Dial is unavailable.
  } finally {
    try {
      if (record.previousOverrides === null) {
        fs.rmSync(providerOverridesPath, { force: true });
        overridesRestored = !fs.existsSync(providerOverridesPath);
      } else {
        const contents = Buffer.from(record.previousOverrides, "base64");
        fs.writeFileSync(providerOverridesPath, contents, { mode: 0o600 });
        fs.chmodSync(providerOverridesPath, 0o600);
        overridesRestored = fs.readFileSync(providerOverridesPath).equals(contents);
      }
    } catch {
      // Retain both original values in the recovery record for another attempt.
    }
  }
  if (!personaRestored || !overridesRestored) {
    emit("restoration_incomplete", { personaRestored, overridesRestored });
    throw new SmokeError("Restoration did not verify. The recovery record was retained; run --recover before another test.");
  }
  fs.rmSync(restorePath);
  emit("controlled_persona_restored", { verified: true, providerOverridesRestored: true });
}

async function observe(requestId?: string) {
  const request = requestId ? getRequest(requestId) : listRequests()
    .filter((candidate) => candidate.id.startsWith("req_live_"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  // refresh also pumps queued calls. Only enter it when every attempt has already dispatched.
  if (!request || request.calls.length === 0 || request.calls.some((call) => call.state === "queued_local")
    || !request.calls.some((call) => call.dialCallId)) {
    throw new SmokeError("No fully dispatched smoke test is available to observe; queued calls will not be sent.");
  }
  const updated = await refresh(request.id);
  const call = updated?.calls.find((candidate) => candidate.purpose === "quote");
  emit("observed_call", {
    requestId: request.id, status: updated?.status, state: call?.state,
    extractionStatus: call?.extractionStatus, extractionFailed: Boolean(call?.extractionError),
    outcome: call?.quoteResult?.outcome, priceLowUsd: call?.quote?.priceLowUsd,
    visitFeeUsd: call?.quote?.visitFeeUsd, durationSec: call?.durationSec,
  });
}

async function main() {
  if (process.env.HANDY_LIVE_DEMO !== "1") {
    throw new SmokeError("Set HANDY_LIVE_DEMO=1 to acknowledge one controlled Dial-to-Dial test call.");
  }
  const liveExtraction = process.argv.includes("--live-extraction");
  if (["1", "true"].includes(process.env.MOCK_DIAL ?? "")) {
    throw new SmokeError("The smoke test requires live Dial (MOCK_DIAL=0).");
  }
  if (liveExtraction) {
    if ([process.env.MOCK_CLAUDE, process.env.MOCK_CLAUDE_EXTRACT].some((value) => value === "1" || value === "true")) {
      throw new SmokeError("--live-extraction requires MOCK_CLAUDE=0 and MOCK_CLAUDE_EXTRACT=0.");
    }
    required("ANTHROPIC_API_KEY");
  } else if (process.env.MOCK_CLAUDE !== "1") {
    throw new SmokeError("Use MOCK_CLAUDE=1 for deterministic extraction or explicitly opt into --live-extraction.");
  }

  const apiKey = required("DIAL_API_KEY");
  const coordinatorId = required("DIAL_FROM_NUMBER_ID");
  const providerNumberId = required("DIAL_RECEPTIONIST_NUMBER_ID");
  if (coordinatorId === providerNumberId) throw new SmokeError("The coordinator and provider must be different controlled numbers.");

  const client = new DialClient({ apiKey, userAgent: "handy-app-smoke/0.1" });
  if (process.argv.includes("--observe") && process.argv.includes("--recover")) {
    throw new SmokeError("Choose either --observe or --recover.");
  }
  if (process.argv.includes("--observe")) {
    await observe(fs.existsSync(restorePath) ? readRecovery().requestId : undefined);
    return;
  }
  if (process.argv.includes("--recover")) {
    if (!fs.existsSync(restorePath)) throw new SmokeError("No interrupted smoke test needs restoration.");
    const recovery = readRecovery();
    if (recovery.providerNumberId !== providerNumberId) throw new SmokeError("Recovery record belongs to another provider number.");
    await restore(client, recovery);
    return;
  }
  if (fs.existsSync(restorePath)) throw new SmokeError("Recover the interrupted smoke test with --recover before placing another call.");
  const photoPath = approvedPhotoPath();
  const sendPhoto = process.argv.includes("--send-photo");
  if (sendPhoto && !photoPath) throw new SmokeError("--send-photo requires an explicitly approved --photo=data/uploads/... path.");
  if (sendPhoto) localAppUrl();
  const numbers = await client.listNumbers();
  const coordinator = numbers.find((number) => number.id === coordinatorId);
  const receiver = numbers.find((number) => number.id === providerNumberId);
  if (!coordinator?.callingEnabled || !receiver?.callingEnabled) {
    throw new SmokeError("Both configured controlled numbers must be present and voice enabled.");
  }
  const active = (await client.listCalls()).filter((call) =>
    [coordinatorId, providerNumberId].includes(call.phoneNumberId) && ["Queued", "Ringing", "In-Progress"].includes(call.status.state),
  );
  if (active.length) throw new SmokeError("A controlled demo line is already in use.");

  const providerId = "plumb_rooter";
  const previousOverrides = fs.existsSync(providerOverridesPath) ? fs.readFileSync(providerOverridesPath) : null;
  const originalInstruction = receiver.inboundInstruction ?? "";
  const requestId = `req_live_${randomUUID().slice(0, 8)}`;
  const recovery: RecoveryRecord = {
    schemaVersion: 1, requestId, providerNumberId, inboundInstruction: originalInstruction,
    previousOverrides: previousOverrides?.toString("base64") ?? null, createdAt: nowIso(),
  };
  // Exclusive creation also prevents two harnesses from changing the same receiver concurrently.
  writePrivate(restorePath, recovery, true);
  const request: RepairRequest = {
    id: requestId,
    title: "Controlled sink drain quote test",
    description: "Water drips from the kitchen sink drain connection only while the faucet is running.",
    requesterRole: "homeowner",
    propertyId: "p1",
    unit: "Main home",
    room: "Kitchen",
    photoPath,
    status: "diagnosed",
    diagnosis: {
      title: "Possible sink drain connection leak",
      likelyCause: "Loose slip nut or worn washer; not confirmed",
      trade: "plumber",
      urgency: "soon",
      needsOnsiteInspection: false,
      costRangeUsd: [150, 350],
      jobBrief: "Inspect and repair a standard kitchen sink drain connection leak.",
      questionsForProviders: [],
      confidence: 0.72,
    },
    unitInsight: null,
    rankedProviders: [],
    calls: [],
    selectedProviderId: null,
    offeredSlots: [],
    accessNote: "",
    approval: null,
    scheduledSlot: null,
    notice: null,
    timeline: [{ status: "diagnosed", at: nowIso() }],
    userActiveSec: 0,
    createdAt: nowIso(),
  };

  if (photoPath && !buildRepairPacket(request).canSend) {
    fs.rmSync(restorePath);
    throw new SmokeError("The approved photo does not meet the JPEG/PNG and 1 MB packet requirements; no call was placed.");
  }

  const persona = [
    "You are the AI receptionist for a fictional plumbing company in an authorized agent-to-agent test. Briefly disclose that you are an AI receptionist.",
    "The caller is Handy collecting a hypothetical quote. This is not a real work order. Be concise, answer the questions directly, confirm a correct readback, then say goodbye and end the call.",
    "Quote USD 220 flat to repair the standard sink drain connection, including labor and standard fittings. There is no visit fee. The estimate is subject to confirmation on arrival and extra work needs approval.",
    "Offer October 13, 2026 from 9 to 11 AM Pacific or October 14, 2026 from 1 to 3 PM Pacific. State a 90-day workmanship warranty.",
    sendPhoto
      ? "A clearly labeled synthetic repair illustration may arrive by MMS during this test call. Only claim to have reviewed it if your actual tools expose the media to you. If the voice agent cannot access it, explicitly say you cannot view the image; do not infer image contents from the caller. Continue providing the provisional quote even if the image is unavailable."
      : "You have not reviewed photos.",
    "Do not request an address, payment, or appointment.",
  ].join("\n");

  let activeCallId: string | null = null;
  let photoAttempted = false;
  let photoResult: PhotoSendResult | null = null;
  try {
    writePrivate(providerOverridesPath, { [providerId]: receiver.number });
    saveRequest(request);
    await client.setNumberProperties(providerNumberId, { inboundInstruction: persona });
    const provider = getProvider(providerId);
    if (!provider?.contactVerified) throw new SmokeError("Controlled provider override was not loaded.");
    emit("preflight_passed", { requestId, providerId, controlledNumbersVerified: true, liveExtraction, photoAttached: Boolean(photoPath), sendPhoto });
    await startQuoteCalls(request, [provider]);

    const deadline = Date.now() + 300_000;
    let lastState = "";
    while (Date.now() < deadline) {
      const updated = await refresh(requestId);
      const call = updated?.calls.find((candidate) => candidate.purpose === "quote");
      if (!call) throw new SmokeError("The app did not persist a quote attempt.");
      activeCallId = call.dialCallId;
      const currentState = `${call.dispatchState}/${call.state}/${call.transcriptStatus}/${call.extractionStatus}`;
      if (currentState !== lastState) {
        lastState = currentState;
        emit("app_call_state", { requestId, state: currentState });
      }
      if (sendPhoto && !photoAttempted && call.state === "In-Progress") {
        photoAttempted = true;
        photoResult = await sendPhotoDuringCall(updated!, providerId, call.id);
        if (photoResult.mode !== "live" || photoResult.dispatchState !== "accepted") {
          throw new SmokeError("Photo was not accepted as a live message; inspect the saved message before another attempt.");
        }
      }
      if (updated?.status === "quotes_ready" && call.quoteResult) {
        if (call.quoteResult.outcome !== "quote_received" || call.quoteResult.quote.priceLowUsd !== 220) {
          throw new SmokeError("The completed call did not produce the expected controlled quote.");
        }
        if (sendPhoto && !photoAttempted) throw new SmokeError("Quote succeeded, but no In-Progress interval was observed for the requested photo send.");
        emit("smoke_passed", {
          requestId,
          outcome: call.quoteResult.outcome,
          priceLowUsd: call.quoteResult.quote.priceLowUsd,
          visitFeeUsd: call.quoteResult.quote.visitFeeUsd,
          evidenceCount: call.quoteResult.evidence.length,
          liveExtraction,
          photoAttempted,
          photoAccepted: photoResult?.mode === "live" && photoResult.dispatchState === "accepted",
          photoDeliveryState: photoResult?.deliveryState ?? null,
          photoReviewState: call.quoteResult.photoReviewState,
        });
        activeCallId = null;
        return;
      }
      if (updated?.status === "failed" || call.dispatchState === "send_unknown" || call.dispatchState === "failed") {
        throw new SmokeError(`App quote flow failed in state ${currentState}.`);
      }
      await delay(5_000);
    }
    throw new SmokeError("Timed out waiting for the integrated quote result.");
  } finally {
    try {
      // Dispatch may have persisted an ID before the first polling iteration returned.
      const stored = getRequest(requestId)?.calls.find((call) => call.dialCallId === activeCallId)
        ?? getRequest(requestId)?.calls.find((call) => call.purpose === "quote" && call.dialCallId);
      if (stored?.dialCallId && stored.state !== "Terminated") {
        await client.stopCall(stored.dialCallId).catch(() => emit("call_stop_unconfirmed"));
      }
    } finally {
      await restore(client, recovery);
    }
  }
}

main().catch((error) => {
  emit("smoke_failed", { message: error instanceof SmokeError ? error.message : "Smoke test failed. Inspect private local state; API error details are omitted." });
  process.exitCode = 1;
});
