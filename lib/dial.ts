import fs from "node:fs";
import path from "node:path";
import { config, requireEnv } from "./config";
import type { CallPurpose, CallState, TerminationType } from "./types";

// Owner: P1. Thin REST client for Dial (https://docs.getdial.ai) + a stateless mock.
// Real calls: POST /api/v1/calls, then poll GET /api/v1/calls/{id} — no webhooks, no public URL.

const API = "https://api.getdial.ai/api/v1";

export class DialError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface CallSnapshot {
  state: CallState;
  terminationType: TerminationType | null;
  durationSec: number | null;
  transcript: string | null;
}

export async function placeCall(input: {
  to: string;
  instruction: string;
  maxSec: number;
  purpose?: CallPurpose;
}): Promise<{ dialCallId: string }> {
  if (config.mockDial) return mockPlace(input);
  const res = await fetch(`${API}/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("DIAL_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      fromNumberId: requireEnv("DIAL_FROM_NUMBER_ID"),
      outboundInstruction: input.instruction,
      language: "en-US",
      maxCallDurationSeconds: input.maxSec,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DialError(res.status, errorText(body) ?? `Dial HTTP ${res.status}`);
  const id: string | undefined = body?.call?.id;
  if (!id) throw new DialError(502, "Dial response had no call id");
  return { dialCallId: id };
}

export async function getCall(dialCallId: string): Promise<CallSnapshot> {
  if (config.mockDial) return mockGet(dialCallId);
  const res = await fetch(`${API}/calls/${encodeURIComponent(dialCallId)}`, {
    headers: { Authorization: `Bearer ${requireEnv("DIAL_API_KEY")}` },
    cache: "no-store",
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
  const pending = (state: CallState): CallSnapshot => ({ state, terminationType: null, durationSec: null, transcript: null });
  const noAnswer = purpose === "quote" && tail === "0199";
  let snap: CallSnapshot;
  if (t < 2) snap = pending("Queued");
  else if (t < 5 || (noAnswer && t < 12)) snap = pending("Ringing");
  else if (noAnswer) snap = { state: "Terminated", terminationType: "no-answer", durationSec: 0, transcript: null };
  else if (t < 14) snap = pending("In-Progress");
  else {
    const fixture = purpose === "booking" ? "booking-confirmed" : tail === "0101" ? "quote-ai-receptionist" : "quote-human";
    // Transcript lands ~2s after hang-up, like the real API.
    snap = { state: "Terminated", terminationType: "completed", durationSec: 9, transcript: t < 16 ? null : readFixture(fixture) };
  }
  return Promise.resolve(snap);
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "fixtures", "transcripts", `${name}.txt`), "utf8");
}
