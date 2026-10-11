import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Dial message transport", () => {
  it("uses the mock transport without making a network request", async () => {
    vi.stubEnv("MOCK_DIAL", "1");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { createDialMessageTransport } = await import("../../lib/communications/dial-messages");
    const transport = createDialMessageTransport();
    const result = await transport.send({
      to: "+14155550101",
      body: "Repair packet",
      attachments: [],
    });
    expect(result).toMatchObject({ mode: "mock", deliveryState: "delivered" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("classifies missing live configuration as a definite pre-dispatch failure", async () => {
    vi.stubEnv("MOCK_DIAL", "0");
    vi.stubEnv("DIAL_ALLOWED_RECIPIENTS", "+14155550101");
    vi.stubEnv("DIAL_API_KEY", "");
    vi.stubEnv("DIAL_FROM_NUMBER_ID", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { createDialMessageTransport, MessageTransportError } = await import("../../lib/communications/dial-messages");

    await expect(
      createDialMessageTransport().send({ to: "+14155550101", body: "Repair packet", attachments: [] }),
    ).rejects.toMatchObject({ constructor: MessageTransportError, uncertain: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("maps the documented Dial multipart request and response", async () => {
    vi.stubEnv("MOCK_DIAL", "0");
    vi.stubEnv("DIAL_ALLOWED_RECIPIENTS", "+14155550101");
    vi.stubEnv("DIAL_API_KEY", "test-key");
    vi.stubEnv("DIAL_FROM_NUMBER_ID", "number_demo");
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ message: { id: "message_live", status: "sent" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { createDialMessageTransport } = await import("../../lib/communications/dial-messages");

    const result = await createDialMessageTransport().send({
      to: "+14155550101",
      body: "Repair packet",
      attachments: [],
    });

    expect(result).toEqual({ dialMessageId: "message_live", deliveryState: "pending", mode: "live" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const form = init?.body as FormData;
    expect(url).toBe("https://api.getdial.ai/api/v1/messages");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(form.get("to")).toBe("+14155550101");
    expect(form.get("fromNumberId")).toBe("number_demo");
    expect(form.get("body")).toBe("Repair packet");
  });
});
