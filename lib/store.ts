import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { config } from "./config";
import { getQuoteRevision } from "./communications/approval";
import type { Approval, CallRecord, Property, Provider, RepairRequest, RequestStatus } from "./types";

// JSON-file store: good enough for a single-machine demo. All writes go through save().

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

interface Db { requests: RepairRequest[] }

function readDb(): Db {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Db;
    return { requests: parsed.requests.map(normalizeRequest) };
  } catch {
    return { requests: [] };
  }
}

function normalizeRequest(request: RepairRequest): RepairRequest {
  const calls = (request.calls ?? []).map(normalizeCall);
  const approval = normalizeApproval(request.approval, calls);
  return { ...request, requesterRole: request.requesterRole ?? "property_manager", calls, approval };
}

function normalizeApproval(approval: RepairRequest["approval"], calls: CallRecord[]): Approval | null {
  if (!approval) return null;
  const legacy = approval as Partial<Approval> & Pick<Approval, "providerId" | "amountUsd" | "approvedAt" | "consentText">;
  const quoteCall = calls
    .filter((call) => call.purpose === "quote" && call.providerId === legacy.providerId && call.quote !== null)
    .at(-1);
  return {
    ...legacy,
    quoteCallId: legacy.quoteCallId ?? quoteCall?.id ?? "legacy_unknown",
    quoteRevision: legacy.quoteRevision ?? "legacy_unknown",
  };
}

function normalizeCall(call: CallRecord): CallRecord {
  const transcriptStatus = call.transcript ? "ready" : call.state === "Terminated" ? "unavailable" : "pending";
  const normalized: CallRecord = {
    ...call,
    dispatchState: call.dispatchState ?? (call.dialCallId ? "accepted" : call.state === "queued_local" ? "queued" : "failed"),
    idempotencyKey: call.idempotencyKey ?? `handy:${call.purpose}:${call.id}`,
    outboundInstruction: call.outboundInstruction ?? "",
    quoteJob: call.quoteJob ?? null,
    transcriptStatus: call.transcriptStatus ?? transcriptStatus,
    transcriptTurns: call.transcriptTurns ?? [],
    transcriptHash: call.transcriptHash ?? (call.transcript ? createHash("sha256").update(call.transcript).digest("hex") : null),
    quoteResult: call.quoteResult ?? null,
    extractionStatus: call.extractionStatus ?? (call.quote || call.booking ? "validated" : call.transcript ? "pending" : "not_started"),
    extractionError: call.extractionError ?? null,
    extractAttempts: call.extractAttempts ?? 0,
  };
  normalized.quoteRevision = normalized.quote ? getQuoteRevision(normalized) : null;
  return normalized;
}

function writeDb(db: Db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;
export const nowIso = () => new Date().toISOString();

export function listRequests(): RepairRequest[] {
  return readDb().requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRequest(id: string): RepairRequest | null {
  return readDb().requests.find((r) => r.id === id) ?? null;
}

export function saveRequest(req: RepairRequest): RepairRequest {
  const db = readDb();
  const i = db.requests.findIndex((r) => r.id === req.id);
  if (i >= 0) db.requests[i] = req;
  else db.requests.push(req);
  writeDb(db);
  return req;
}

export function setStatus(req: RepairRequest, status: RequestStatus) {
  if (req.status === status) return;
  req.status = status;
  req.timeline.push({ status, at: nowIso() });
}

export function listProperties(): Property[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "properties.json"), "utf8"));
}

export function getProperty(id: string): Property | null {
  return listProperties().find((p) => p.id === id) ?? null;
}

// providers.json is committed (fake numbers); providers.local.json maps id → real E.164 phone.
export function listProviders(): Provider[] {
  const base: Provider[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "providers.json"), "utf8"));
  let phones: Record<string, string> = {};
  try {
    phones = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "providers.local.json"), "utf8"));
  } catch {
    // no local overrides — mock numbers only
  }
  return base.map((p) => ({
    ...p,
    phone: phones[p.id] ?? p.phone,
    contactVerified: config.mockDial || Object.hasOwn(phones, p.id),
  }));
}

export function getProvider(id: string): Provider | null {
  return listProviders().find((p) => p.id === id) ?? null;
}
