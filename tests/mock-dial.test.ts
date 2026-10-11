import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("mock Dial", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_DIAL", "1");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T13:00:00-07:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("walks a quote call through its lifecycle and returns the human fixture", async () => {
    const dial = await import("../lib/dial");
    const { dialCallId } = await dial.placeCall({ to: "+14155550102", instruction: "x", maxSec: 60, idempotencyKey: "test-quote-1", purpose: "quote" });
    expect((await dial.getCall(dialCallId)).state).toBe("Queued");
    vi.advanceTimersByTime(6_000);
    expect((await dial.getCall(dialCallId)).state).toBe("In-Progress");
    vi.advanceTimersByTime(9_000);
    const ended = await dial.getCall(dialCallId);
    expect(ended).toMatchObject({ state: "Terminated", terminationType: "completed", transcript: null });
    vi.advanceTimersByTime(2_000);
    const transcribed = await dial.getCall(dialCallId);
    expect(transcribed.transcript).toContain("$175 flat");
    expect(transcribed.transcriptTurns.some((turn) => turn.speaker === "user" && turn.text.includes("$175 flat"))).toBe(true);
  });

  it("never answers numbers ending in 0199", async () => {
    const dial = await import("../lib/dial");
    const { dialCallId } = await dial.placeCall({ to: "+14155550199", instruction: "x", maxSec: 60, idempotencyKey: "test-quote-2", purpose: "quote" });
    vi.advanceTimersByTime(13_000);
    expect(await dial.getCall(dialCallId)).toMatchObject({ state: "Terminated", terminationType: "no-answer" });
  });
});
