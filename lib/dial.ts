import fs from "node:fs";
import path from "node:path";
import { config, requireEnv } from "./config";
import type { CallPurpose, CallState, TerminationType, TranscriptSpeaker, TranscriptTurn } from "./types";

// Owner: P1. Thin REST client for Dial (https://docs.getdial.ai) + a stateless mock.
// Real calls: POST /api/v1/calls, then poll GET /api/v1/calls/{id} — no webhooks, no public URL.

const API = "https://api.getdial.ai/api/v1";

// Every Dial request runs inside the per-request lock, so none may hang indefinitely.
const PLACE_TIMEOUT_MS = 15_000;
const POLL_TIMEOUT_MS = 10_000;

export class DialError extends Error {
  constructor(public status: number, message: string, public uncertain = false) {
    super(message);
  }
}

export interface CallSnapshot {
  state: CallState;
  terminationType: TerminationType | null;
  durationSec: number | null;
  transcript: string | null;
  transcriptTurns: TranscriptTurn[];
}

export async function placeCall(input: {
  to: string;
  instruction: string;
  maxSec: number;
  idempotencyKey: string;
  purpose?: CallPurpose;
}): Promise<{ dialCallId: string }> {
  if (config.mockDial) return mockPlace(input);
  const headers = {
    Authorization: `Bearer ${requireEnv("DIAL_API_KEY")}`,
    "Content-Type": "application/json",
    "Idempotency-Key": input.idempotencyKey,
  };
  const body = JSON.stringify({
    to: input.to,
    fromNumberId: requireEnv("DIAL_FROM_NUMBER_ID"),
    outboundInstruction: input.instruction,
    language: "en-US",
    maxCallDurationSeconds: input.maxSec,
  });

  // One immediate retry is safe because both attempts carry the same persisted idempotency key.
  // If neither response establishes the call ID, the orchestrator records send_unknown and stops.
  let previouslyAmbiguous = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      // A timeout is just another ambiguous outcome: retried once with the same idempotency key.
      response = await fetch(`${API}/calls`, { method: "POST", headers, body, signal: AbortSignal.timeout(PLACE_TIMEOUT_MS) });
    } catch {
      previouslyAmbiguous = true;
      if (attempt === 0) continue;
      throw new DialError(0, "Dial call placement status is unknown; reconcile before retrying.", true);
    }
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const uncertain = previouslyAmbiguous || response.status >= 500;
      if (uncertain && attempt === 0) {
        previouslyAmbiguous = true;
        continue;
      }
      throw new DialError(response.status, errorText(responseBody) ?? `Dial HTTP ${response.status}`, uncertain);
    }
    const id: string | undefined = responseBody?.call?.id;
    if (id) return { dialCallId: id };
    previouslyAmbiguous = true;
    if (attempt === 0) continue;
    throw new DialError(502, "Dial accepted call placement but returned no call id; reconcile before retrying.", true);
  }
  throw new DialError(0, "Dial call placement status is unknown; reconcile before retrying.", true);
}

export async function getCall(dialCallId: string): Promise<CallSnapshot> {
  if (config.mockDial) return mockGet(dialCallId);
  const res = await fetch(`${API}/calls/${encodeURIComponent(dialCallId)}`, {
    headers: { Authorization: `Bearer ${requireEnv("DIAL_API_KEY")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS), // a hung poll must throw, not hold the request lock
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DialError(res.status, errorText(body) ?? `Dial HTTP ${res.status}`);
  const call = body?.call ?? {};
  const state: string = call.status?.state ?? "Unknown";
  return {
    // "Unknown" (no lifecycle event yet) is treated as Queued so we keep polling.
    state: (["Queued", "Ringing", "In-Progress", "Terminated"].includes(state) ? state : "Queued") as CallState,
    terminationType: call.status?.terminationType ?? null,
    durationSec: call.duration ?? null,
    transcript: call.transcript ?? null,
    transcriptTurns: normalizeTurns(call.transcriptTurns, call.transcript),
  };
}

function errorText(body: unknown): string | null {
  const err = (body as { error?: unknown })?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return null;
}

// ---- Mock -------------------------------------------------------------------------------
// The call id encodes purpose, start time and the last 4 digits of the number, so the mock
// survives dev-server reloads. Numbers ending in 0199 never answer; 0101 is the AI receptionist.

function mockPlace(input: { to: string; purpose?: CallPurpose }) {
  const tail = input.to.replace(/\D/g, "").slice(-4);
  return Promise.resolve({ dialCallId: `mock_${input.purpose ?? "quote"}_${Date.now()}_${tail}` });
}

function mockGet(dialCallId: string): Promise<CallSnapshot> {
  const [, purpose, startedMs, tail] = dialCallId.split("_");
  const t = (Date.now() - Number(startedMs)) / 1000;
  const pending = (state: CallState): CallSnapshot => ({ state, terminationType: null, durationSec: null, transcript: null, transcriptTurns: [] });
  const noAnswer = purpose === "quote" && tail === "0199";
  let snap: CallSnapshot;
  if (t < 2) snap = pending("Queued");
  else if (t < 5 || (noAnswer && t < 12)) snap = pending("Ringing");
  else if (noAnswer) snap = { state: "Terminated", terminationType: "no-answer", durationSec: 0, transcript: null, transcriptTurns: [] };
  else if (t < 14) snap = pending("In-Progress");
  else {
    const fixture = purpose === "booking" ? "booking-confirmed" : tail === "0101" ? "quote-ai-receptionist" : "quote-human";
    // Transcript lands ~2s after hang-up, like the real API.
    const transcript = t < 16 ? null : readFixture(fixture);
    snap = { state: "Terminated", terminationType: "completed", durationSec: 9, transcript, transcriptTurns: normalizeTurns(null, transcript) };
  }
  return Promise.resolve(snap);
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "fixtures", "transcripts", `${name}.txt`), "utf8");
}

function normalizeTurns(raw: unknown, transcript: unknown): TranscriptTurn[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((item): TranscriptTurn[] => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      if (!isSpeaker(value.speaker) || typeof value.text !== "string") return [];
      return [{
        speaker: value.speaker,
        text: value.text,
        startMs: finiteNumber(value.startMs),
        endMs: finiteNumber(value.endMs),
      }];
    });
  }
  if (typeof transcript !== "string") return [];
  return transcript.split("\n").flatMap((line): TranscriptTurn[] => {
    const match = line.match(/^\s*(Agent|User|Transfer Target):\s*(.*)$/i);
    if (!match || !match[2]) return [];
    const speaker = match[1].toLowerCase().replace(" ", "_") as TranscriptSpeaker;
    // Flat transcripts contain no timing evidence. Zero means unavailable, not measured.
    return [{ speaker, text: match[2], startMs: 0, endMs: 0 }];
  });
}

function isSpeaker(value: unknown): value is TranscriptSpeaker {
  return value === "agent" || value === "user" || value === "transfer_target";
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
