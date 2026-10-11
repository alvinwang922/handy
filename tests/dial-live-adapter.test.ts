import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("live Dial adapter", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_DIAL", "0");
    vi.stubEnv("DIAL_API_KEY", "test-secret");
    vi.stubEnv("DIAL_FROM_NUMBER_ID", "number_1");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends the persisted idempotency key and retains transcript turns", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ call: { id: "dial_1" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ call: {
        status: { state: "Terminated", terminationType: "completed" },
        duration: 42,
        transcript: "User: The estimate is $220.",
        transcriptTurns: [{ speaker: "user", text: "The estimate is $220.", startMs: 10, endMs: 100 }],
      } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");

    await dial.placeCall({ to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_1", purpose: "quote" });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Idempotency-Key")).toBe("handy:quote:call_1");
    expect((await dial.getCall("dial_1")).transcriptTurns[0]).toMatchObject({ speaker: "user", text: "The estimate is $220." });
  });

  it("marks an interrupted POST unknown after one idempotent retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("socket closed"));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");
    await expect(dial.placeCall({
      to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_2", purpose: "quote",
    })).rejects.toMatchObject({ uncertain: true, status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Idempotency-Key")).toBe("handy:quote:call_2");
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Idempotency-Key")).toBe("handy:quote:call_2");
  });

  it("recovers one ambiguous dispatch using the same idempotency key", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("socket closed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ call: { id: "dial_existing" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");
    await expect(dial.placeCall({
      to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_3", purpose: "quote",
    })).resolves.toEqual({ dialCallId: "dial_existing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([402, 429])("keeps a lost first response ambiguous when the retry returns HTTP %i", async (status) => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("socket closed"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "retry rejected" }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");

    await expect(dial.placeCall({
      to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_4",
    })).rejects.toMatchObject({ uncertain: true, status });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an ambiguous server response unknown after a rejected retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "server error" }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "retry rejected" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");

    await expect(dial.placeCall({
      to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_5",
    })).rejects.toMatchObject({ uncertain: true, status: 400 });
  });

  it("treats an initial explicit rejection as a known failure without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "rate limit" }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const dial = await import("../lib/dial");

    await expect(dial.placeCall({
      to: "+14155550100", instruction: "quote", maxSec: 120, idempotencyKey: "handy:quote:call_6",
    })).rejects.toMatchObject({ uncertain: false, status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not invent timing when only a flat transcript is available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ call: {
      status: { state: "Terminated", terminationType: "completed" },
      transcript: "Agent: What is the estimate?\nUser: The estimate is $220.",
    } }), { status: 200 })));
    const dial = await import("../lib/dial");

    expect((await dial.getCall("dial_flat")).transcriptTurns).toEqual([
      { speaker: "agent", text: "What is the estimate?", startMs: 0, endMs: 0 },
      { speaker: "user", text: "The estimate is $220.", startMs: 0, endMs: 0 },
    ]);
  });
});
