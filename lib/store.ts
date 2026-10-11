import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Property, Provider, RepairRequest, RequestStatus } from "./types";

// JSON-file store: good enough for a single-machine demo. All writes go through save().

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

interface Db { requests: RepairRequest[] }

function readDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Db;
  } catch {
    return { requests: [] };
  }
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
  return base.map((p) => ({ ...p, phone: phones[p.id] ?? p.phone }));
}

export function getProvider(id: string): Provider | null {
  return listProviders().find((p) => p.id === id) ?? null;
}
