export type MessageDispatchState = "dispatching" | "accepted" | "failed" | "send_unknown";
export type MessageDeliveryState = "unknown" | "pending" | "delivered" | "undelivered" | "failed" | "unconfirmed";
export type PhotoReviewState = "unknown" | "not_reviewed" | "reviewed";

export interface PacketPhoto {
  id: "primary";
  contentType: "image/jpeg" | "image/png";
  sizeBytes: number;
  sha256: string;
  filePath: string;
  previewUrl: string;
}

export interface RepairPacket {
  requestId: string;
  packetVersion: string;
  summary: string;
  photos: PacketPhoto[];
  warnings: string[];
  canSend: boolean;
}

export interface RepairPacketPreview {
  requestId: string;
  providerId: string;
  packetVersion: string;
  summary: string;
  photos: Array<Pick<PacketPhoto, "id" | "contentType" | "sizeBytes" | "previewUrl">>;
  warnings: string[];
  canSend: boolean;
}

export interface MessageRecord {
  id: string;
  requestId: string;
  providerId: string;
  callId: string | null;
  packetVersion: string;
  idempotencyKey: string;
  requestFingerprint: string;
  body: string;
  photoCount: number;
  dispatchState: MessageDispatchState;
  deliveryState: MessageDeliveryState;
  photoReviewState: PhotoReviewState;
  dialMessageId: string | null;
  mode: "mock" | "live";
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageStore {
  listByRequest(requestId: string): MessageRecord[];
  findByIdempotencyKey(requestId: string, idempotencyKey: string): MessageRecord | null;
  findByPacket(requestId: string, providerId: string, packetVersion: string): MessageRecord | null;
  save(record: MessageRecord): MessageRecord;
}

export interface MessageTransportInput {
  to: string;
  body: string;
  attachments: Array<Pick<PacketPhoto, "filePath" | "contentType">>;
}

export interface MessageTransportResult {
  dialMessageId: string;
  deliveryState: MessageDeliveryState;
  mode: "mock" | "live";
}

export interface MessageTransport {
  mode: "mock" | "live";
  send(input: MessageTransportInput): Promise<MessageTransportResult>;
}
