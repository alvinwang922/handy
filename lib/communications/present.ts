import type { MessageRecord } from "./types";

export type PublicMessageRecord = Omit<MessageRecord, "idempotencyKey" | "requestFingerprint">;

export function presentMessage(record: MessageRecord): PublicMessageRecord {
  const publicRecord: Partial<MessageRecord> = { ...record };
  delete publicRecord.idempotencyKey;
  delete publicRecord.requestFingerprint;
  return publicRecord as PublicMessageRecord;
}
