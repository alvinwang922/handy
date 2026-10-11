import crypto, { randomUUID } from "node:crypto";
import type { Provider, RepairRequest } from "../types";
import { MessageTransportError } from "./dial-messages";
import { PacketError, requireSendablePacket } from "./packet";
import type { MessageRecord, MessageStore, MessageTransport } from "./types";

export class SharePacketError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface SharePacketInput {
  request: RepairRequest;
  provider: Provider;
  packetVersion: string;
  idempotencyKey: string;
  callId?: string | null;
  projectRoot?: string;
}

const inFlight = new Map<string, Promise<MessageRecord>>();

export async function shareRepairPacket(
  input: SharePacketInput,
  ports: { store: MessageStore; transport: MessageTransport; now?: () => string },
): Promise<MessageRecord> {
  const key = `${input.request.id}:${input.provider.id}:${input.packetVersion}`;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = shareOnce(input, ports);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }
}

async function shareOnce(
  input: SharePacketInput,
  ports: { store: MessageStore; transport: MessageTransport; now?: () => string },
): Promise<MessageRecord> {
  const { request, provider, packetVersion, idempotencyKey } = input;
  const now = ports.now ?? (() => new Date().toISOString());
  if (!idempotencyKey.trim()) throw new SharePacketError(400, "Idempotency-Key is required.");

  const requestFingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify({ requestId: request.id, providerId: provider.id, packetVersion, callId: input.callId ?? null }))
    .digest("hex");
  const keyed = ports.store.findByIdempotencyKey(request.id, idempotencyKey);
  if (keyed) {
    if (keyed.requestFingerprint !== requestFingerprint) {
      throw new SharePacketError(409, "Idempotency-Key was already used for a different packet send.");
    }
    return keyed;
  }
  // Any earlier attempt that may have reached the provider (accepted, or send_unknown) wins: never
  // send twice. Only when every earlier attempt definitely failed may this packet be sent again.
  const earlier = ports.store
    .listByRequest(request.id)
    .filter((record) => record.providerId === provider.id && record.packetVersion === packetVersion);
  const live = earlier.filter((record) => record.dispatchState !== "failed").at(-1);
  if (live) return live;

  const packet = requireSendablePacket(request, provider, packetVersion, { projectRoot: input.projectRoot });
  if (input.callId) {
    const call = request.calls.find((candidate) => candidate.id === input.callId);
    if (!call || call.providerId !== provider.id || call.purpose !== "quote") {
      throw new SharePacketError(422, "Call does not belong to this repair and provider quote outreach.");
    }
  }

  const timestamp = now();
  let record: MessageRecord = {
    id: `msg_${randomUUID().slice(0, 8)}`,
    requestId: request.id,
    providerId: provider.id,
    callId: input.callId ?? null,
    packetVersion,
    idempotencyKey,
    requestFingerprint,
    body: packet.summary,
    photoCount: packet.photos.length,
    dispatchState: "dispatching",
    deliveryState: "unknown",
    photoReviewState: "unknown",
    dialMessageId: null,
    mode: ports.transport.mode,
    error: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  ports.store.save(record);

  try {
    const sent = await ports.transport.send({
      to: provider.phone,
      body: packet.summary,
      attachments: packet.photos.map(({ filePath, contentType }) => ({ filePath, contentType })),
    });
    record = {
      ...record,
      dispatchState: "accepted",
      deliveryState: sent.deliveryState,
      dialMessageId: sent.dialMessageId,
      mode: sent.mode,
      updatedAt: now(),
    };
  } catch (error) {
    const uncertain = error instanceof MessageTransportError ? error.uncertain : true;
    record = {
      ...record,
      dispatchState: uncertain ? "send_unknown" : "failed",
      deliveryState: uncertain ? "unknown" : "failed",
      error: error instanceof Error ? error.message : "Message send failed",
      updatedAt: now(),
    };
  }
  return ports.store.save(record);
}

export function communicationErrorStatus(error: unknown): number {
  if (error instanceof PacketError || error instanceof SharePacketError) return error.status;
  return 500;
}
