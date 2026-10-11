import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DialClient } from "@getdial/sdk";
import { brief, scenarios } from "./scenarios";
import { buildQuoteJob } from "./contract";

// Two explicitly configured account-owned agents only. Keep their IDs in ignored
// local configuration; phone numbers resolve in memory and are never logged.
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const root = path.resolve("prototypes/dial-contract/.local");
const emit = (event: string, data: object = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));

function persist(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

async function readApiKey(): Promise<string> {
  const secretPath = path.join(root, ".env");
  if (!process.env.DIAL_API_KEY && fs.existsSync(secretPath)) process.loadEnvFile(secretPath);
  if (process.env.DIAL_API_KEY) return process.env.DIAL_API_KEY;
  if (!process.stdin.isTTY) throw new Error("Set DIAL_API_KEY or run interactively for hidden key input.");
  console.log("Ready for Dial API key on stdin (input hidden).");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (buffer: Buffer) => {
      const text = buffer.toString();
      if (text.includes("\u0003")) { cleanup(); reject(new Error("Canceled before authentication.")); return; }
      value += text;
      if (/[\r\n]/.test(value)) { cleanup(); resolve(value.trim()); }
    };
    const cleanup = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    process.stdin.on("data", onData);
  });
}

function safeError(error: unknown) {
  // SDK messages can embed account data. Emit only a non-sensitive category/status.
  const e = error as { status?: number; statusCode?: number; name?: string };
  return { category: e?.name ?? "Error", httpStatus: e?.status ?? e?.statusCode ?? null };
}

async function main() {
  if (!process.argv.includes("--live")) {
    for (const scenario of scenarios) {
      const job = buildQuoteJob(brief, scenario.provider, `preview-${scenario.id}`);
      emit("validated_job", { scenario: scenario.id, requestId: job.requestId, briefVersion: job.briefVersion, providerId: job.providerId, briefHash: job.briefHash, purpose: job.purpose, maxCallDurationSeconds: job.maxCallDurationSeconds });
    }
    emit("dry_run_complete", { liveCalls: 0 });
    return;
  }

  const apiKey = await readApiKey();
  const numberConfig = JSON.parse(fs.readFileSync(path.join(root, "numbers.json"), "utf8"));
  const COORDINATOR_ID: unknown = numberConfig.coordinatorId;
  const PROVIDER_ID: unknown = numberConfig.providerId;
  if (typeof COORDINATOR_ID !== "string" || !COORDINATOR_ID || typeof PROVIDER_ID !== "string" || !PROVIDER_ID || COORDINATOR_ID === PROVIDER_ID) throw new Error("Configure two distinct approved agent IDs in .local/numbers.json before calling.");
  if (process.argv.includes("--save-key")) {
    if (!/^sk_live_[A-Za-z0-9_-]+$/.test(apiKey)) throw new Error("Invalid key format.");
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(root, ".env"), `DIAL_API_KEY=${apiKey}\n`, { mode: 0o600 });
    fs.chmodSync(path.join(root, ".env"), 0o600);
    emit("local_secret_saved", { gitignored: true });
  }
  const client = new DialClient({ apiKey, userAgent: "handy-contract-prototype/0.1" });
  const numbers = await client.listNumbers();
  const coordinator = numbers.find(n => n.id === COORDINATOR_ID);
  const provider = numbers.find(n => n.id === PROVIDER_ID);
  if (!coordinator || !provider || coordinator.id === provider.id || !coordinator.callingEnabled || !provider.callingEnabled) throw new Error("The two authorized voice-enabled demo numbers are not available on this account.");
  const active = (await client.listCalls()).filter(c => ["Queued", "Ringing", "In-Progress"].includes(c.status.state) && [COORDINATOR_ID, PROVIDER_ID].includes(c.phoneNumberId));
  if (active.length) throw new Error("A demo line is already busy; do not change its persona.");

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(root, runId);
  const originalInstruction = provider.inboundInstruction;
  persist(path.join(runDir, "restore.json"), { providerId: PROVIDER_ID, inboundInstruction: originalInstruction });
  persist(path.join(runDir, "brief.json"), brief);
  emit("preflight_passed", { runId, ownedNumbersVerified: true, scenarioCount: scenarios.length, executionMode: "live_voice_fictional_provider" });

  let personaChanged = false;
  let activeCallId: string | null = null;
  let completed = 0;
  try {
    for (const scenario of scenarios) {
      personaChanged = true; // Restore even if PATCH succeeds remotely but its response is lost.
      await client.setNumberProperties(provider.id, { inboundInstruction: scenario.inboundInstruction });
      const verified = (await client.listNumbers()).find(n => n.id === PROVIDER_ID);
      if (verified?.inboundInstruction !== scenario.inboundInstruction) throw new Error("Provider persona did not persist.");
      const attemptId = randomUUID();
      const job = buildQuoteJob(brief, scenario.provider, attemptId);
      const attemptPath = path.join(runDir, `${scenario.id}.json`);
      const record: Record<string, unknown> = { scenarioId: scenario.id, provider: scenario.provider, job, mode: "live_voice_fictional_provider", dispatchState: "dispatching", quoteState: "awaiting_transcript", startedAt: new Date().toISOString() };
      persist(attemptPath, record); // Persist before external side effect.
      emit("dispatching", { scenario: scenario.id, attemptId });
      let placed;
      try {
        placed = await client.makeCall({ to: provider.number, fromNumberId: coordinator.id, outboundInstruction: job.outboundInstruction, maxCallDurationSeconds: job.maxCallDurationSeconds, language: "en-US", idempotencyKey: job.idempotencyKey });
      } catch (error) {
        Object.assign(record, { dispatchState: "send_unknown", error: safeError(error), reconciliationRequired: true });
        persist(attemptPath, record);
        emit("dispatch_unknown_no_retry", { scenario: scenario.id, ...safeError(error) });
        throw error;
      }
      activeCallId = placed.id;
      Object.assign(record, { dialCallId: placed.id, dispatchState: "accepted" });
      persist(attemptPath, record);
      emit("call_accepted", { scenario: scenario.id, dialCallId: placed.id });
      const deadline = Date.now() + 360_000;
      let snapshot = placed;
      let previousState = "";
      while (Date.now() < deadline) {
        if (snapshot.status.state !== previousState) {
          previousState = snapshot.status.state;
          emit("call_state", { scenario: scenario.id, state: previousState });
        }
        if (snapshot.status.state === "Terminated") {
          activeCallId = null;
          if (snapshot.transcript || snapshot.status.terminationType !== "completed") break;
        }
        await delay(5000);
        snapshot = await client.getCall(placed.id); // Read retries never place another call.
      }
      if (snapshot.status.state !== "Terminated") {
        await client.stopCall(placed.id);
        Object.assign(record, { quoteState: "call_timeout", reconciliationRequired: true });
        persist(attemptPath, record);
        throw new Error("Call did not reach a terminal state within the bounded wait.");
      }
      const source = { dialCallId: placed.id, direction: "outbound", terminationType: snapshot.status.terminationType, durationSec: snapshot.duration, transcript: snapshot.transcript, turns: snapshot.transcriptTurns ?? [] };
      Object.assign(record, { callState: snapshot.status.state, terminationType: snapshot.status.terminationType, source, quoteState: snapshot.transcript ? "awaiting_extraction" : "transcript_unavailable", endedAt: new Date().toISOString() });
      persist(attemptPath, record);
      emit("call_result", { scenario: scenario.id, dialCallId: placed.id, terminationType: snapshot.status.terminationType, durationSec: snapshot.duration, transcriptAvailable: !!snapshot.transcript, turnCount: source.turns.length });
      if (snapshot.status.terminationType !== "completed" || !snapshot.transcript) throw new Error("No completed transcript; inspect this attempt before additional calls.");
      completed++;
      // Allow the paired inbound leg to finish before changing the same receptionist.
      const pairDeadline = Date.now() + 30_000;
      while (true) {
        const inUse = (await client.listCalls()).some(c => [COORDINATOR_ID, PROVIDER_ID].includes(c.phoneNumberId) && ["Queued", "Ringing", "In-Progress"].includes(c.status.state));
        if (!inUse) break;
        if (Date.now() > pairDeadline) throw new Error("Paired call leg is still active; halt before the next persona.");
        await delay(3000);
      }
    }
  } finally {
    if (activeCallId) {
      try { await client.stopCall(activeCallId); } catch { emit("stop_requires_review", { dialCallId: activeCallId }); }
    }
    if (personaChanged) {
      try {
        await client.setNumberProperties(provider.id, { inboundInstruction: originalInstruction ?? "" });
        const restored = (await client.listNumbers()).find(n => n.id === PROVIDER_ID);
        const ok = (restored?.inboundInstruction ?? "") === (originalInstruction ?? "");
        persist(path.join(runDir, "restoration.json"), { verified: ok, checkedAt: new Date().toISOString() });
        emit("persona_restored", { verified: ok });
        if (!ok) throw new Error("Restoration mismatch");
      } catch (error) { emit("restoration_requires_review", safeError(error)); process.exitCode = 1; }
    }
    emit("run_finished", { runId, completedCalls: completed, resultsDirectory: runDir, quoteExtraction: "pending_evidence_review" });
  }
}

main().catch(error => { emit("run_failed", safeError(error)); process.exitCode = 1; });
