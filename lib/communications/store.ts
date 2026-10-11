import fs from "node:fs";
import path from "node:path";
import type { MessageRecord, MessageStore } from "./types";

interface CommunicationsDb {
  messages: MessageRecord[];
}

export class JsonMessageStore implements MessageStore {
  constructor(private dbPath = path.join(process.cwd(), "data", "communications.json")) {}

  listByRequest(requestId: string): MessageRecord[] {
    return this.read().messages.filter((record) => record.requestId === requestId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  findByIdempotencyKey(requestId: string, idempotencyKey: string): MessageRecord | null {
    return this.read().messages.find((record) => record.requestId === requestId && record.idempotencyKey === idempotencyKey) ?? null;
  }

  findByPacket(requestId: string, providerId: string, packetVersion: string): MessageRecord | null {
    return this.read().messages.find(
      (record) => record.requestId === requestId && record.providerId === providerId && record.packetVersion === packetVersion,
    ) ?? null;
  }

  save(record: MessageRecord): MessageRecord {
    const db = this.read();
    const index = db.messages.findIndex((item) => item.id === record.id);
    if (index >= 0) db.messages[index] = record;
    else db.messages.push(record);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const tempPath = `${this.dbPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2));
    fs.renameSync(tempPath, this.dbPath);
    return record;
  }

  private read(): CommunicationsDb {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.dbPath, "utf8")) as Partial<CommunicationsDb>;
      return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { messages: [] };
      throw error;
    }
  }
}

export class InMemoryMessageStore implements MessageStore {
  private messages: MessageRecord[] = [];

  listByRequest(requestId: string) {
    return this.messages.filter((record) => record.requestId === requestId);
  }

  findByIdempotencyKey(requestId: string, idempotencyKey: string) {
    return this.messages.find((record) => record.requestId === requestId && record.idempotencyKey === idempotencyKey) ?? null;
  }

  findByPacket(requestId: string, providerId: string, packetVersion: string) {
    return this.messages.find(
      (record) => record.requestId === requestId && record.providerId === providerId && record.packetVersion === packetVersion,
    ) ?? null;
  }

  save(record: MessageRecord) {
    const copy = structuredClone(record);
    const index = this.messages.findIndex((item) => item.id === record.id);
    if (index >= 0) this.messages[index] = copy;
    else this.messages.push(copy);
    return structuredClone(copy);
  }
}
