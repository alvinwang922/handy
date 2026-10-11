import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageTransportError } from "../../lib/communications/dial-messages";
import { buildRepairPacket } from "../../lib/communications/packet";
import { shareRepairPacket, SharePacketError } from "../../lib/communications/share-packet";
import { InMemoryMessageStore } from "../../lib/communications/store";
import type { MessageTransport } from "../../lib/communications/types";
import { makeProjectRoot, makeRequest, provider } from "./fixtures";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("share repair packet", () => {
  it("deduplicates concurrent sends and keeps delivery separate from review", async () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const request = makeRequest();
    const packet = buildRepairPacket(request, { projectRoot });
    const store = new InMemoryMessageStore();
    const send = vi.fn(async () => ({ dialMessageId: "mock_1", deliveryState: "delivered" as const, mode: "mock" as const }));
    const transport: MessageTransport = { mode: "mock", send };
    const base = { request, provider, packetVersion: packet.packetVersion, callId: "call_demo", projectRoot };

    const [first, second] = await Promise.all([
      shareRepairPacket({ ...base, idempotencyKey: "click-1" }, { store, transport }),
      shareRepairPacket({ ...base, idempotencyKey: "click-2" }, { store, transport }),
    ]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({ dispatchState: "accepted", deliveryState: "delivered", photoReviewState: "unknown" });
  });

  it("records an uncertain send and never blindly resends it", async () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const request = makeRequest();
    const packet = buildRepairPacket(request, { projectRoot });
    const store = new InMemoryMessageStore();
    const send = vi.fn(async () => {
      throw new MessageTransportError("network ended after dispatch", true);
    });
    const transport: MessageTransport = { mode: "live", send };
    const input = { request, provider, packetVersion: packet.packetVersion, callId: "call_demo", projectRoot };

    const first = await shareRepairPacket({ ...input, idempotencyKey: "try-1" }, { store, transport });
    const second = await shareRepairPacket({ ...input, idempotencyKey: "try-2" }, { store, transport });

    expect(send).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ dispatchState: "send_unknown", deliveryState: "unknown" });
  });

  it("rejects reuse of an idempotency key for a different call association", async () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const request = makeRequest({ calls: [...makeRequest().calls, { ...makeRequest().calls[0], id: "call_other" }] });
    const packet = buildRepairPacket(request, { projectRoot });
    const store = new InMemoryMessageStore();
    const transport: MessageTransport = {
      mode: "mock",
      async send() {
        return { dialMessageId: "mock_2", deliveryState: "delivered", mode: "mock" };
      },
    };
    const base = { request, provider, packetVersion: packet.packetVersion, projectRoot, idempotencyKey: "same-key" };
    await shareRepairPacket({ ...base, callId: "call_demo" }, { store, transport });
    await expect(shareRepairPacket({ ...base, callId: "call_other" }, { store, transport })).rejects.toBeInstanceOf(SharePacketError);
  });

  it("returns the original result when a retry arrives after the source photo is unavailable", async () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const request = makeRequest();
    const packet = buildRepairPacket(request, { projectRoot });
    const store = new InMemoryMessageStore();
    const send = vi.fn(async () => ({ dialMessageId: "mock_3", deliveryState: "delivered" as const, mode: "mock" as const }));
    const transport: MessageTransport = { mode: "mock", send };
    const input = { request, provider, packetVersion: packet.packetVersion, callId: "call_demo", projectRoot, idempotencyKey: "retry-key" };

    const first = await shareRepairPacket(input, { store, transport });
    fs.rmSync(`${projectRoot}/data/uploads/repair.jpg`);
    const retry = await shareRepairPacket(input, { store, transport });

    expect(send).toHaveBeenCalledTimes(1);
    expect(retry.id).toBe(first.id);
  });
});
