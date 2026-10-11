import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { config, requireEnv } from "./config";
import { listProviders } from "./store";
import type { ProviderScore, Trade, UnitInsight } from "./types";

// Owner: P4. Keewano = one ordered event stream per entity (provider / unit / request).
// Ingest: REST https://api.keewano.com/event/ingress/v1/json/{custom|in}, `k-token` = project API key.
// Query:  Postgres wire protocol (pgsql.keewano.com:27543), single `events` table, columns = event names,
//         values hold forward until the next event of the same name ("step functions"). No JOINs.

const INGEST = "https://api.keewano.com/event/ingress/v1/json";

type DataType = "none" | "string" | "uint" | "bool" | "timestamp" | "price_usd_cent";

// APPEND-ONLY: a registered id's type can never change. To change an event, add a new id.
export const EVENTS = {
  DataSource: { id: 2000, dataType: "string" },          // every entity's first event: "seed" | "live"
  Trade: { id: 2001, dataType: "string" },               // provider context
  QuoteRequested: { id: 2002, dataType: "none" },
  CallAnswered: { id: 2003, dataType: "none" },
  CallMissed: { id: 2004, dataType: "none" },
  QuotePriceCents: { id: 2005, dataType: "price_usd_cent" },
  JobBooked: { id: 2006, dataType: "none" },
  ArrivedOnTime: { id: 2007, dataType: "none" },
  ArrivedLate: { id: 2008, dataType: "none" },
  QuoteAccuracyPct: { id: 2009, dataType: "uint" },      // final bill ÷ quote × 100
  IssueReported: { id: 2010, dataType: "string" },       // unit: trade of the issue
  Channel: { id: 2020, dataType: "string" },             // request: "manual" | "handled"
  MinutesToBook: { id: 2021, dataType: "uint" },
  UserActiveSec: { id: 2022, dataType: "uint" },
  QuoteApprovedCents: { id: 2023, dataType: "price_usd_cent" },
  ProviderName: { id: 2030, dataType: "string" },        // provider display name, so live SQL/MCP answers show names, not UUIDs
} as const satisfies Record<string, { id: number; dataType: DataType }>;

export type EventName = keyof typeof EVENTS;

export interface KEvent {
  name: EventName;
  value?: string | number | boolean;  // omitted for "none" events
  timestamp?: number;                 // unix seconds; omitted → Keewano stamps receipt time
}

export type KEntity = { kind: "provider" | "unit" | "request"; id: string };

const EVENT_TYPES = Object.entries(EVENTS).map(([name, e]) => ({ eventTypeId: e.id, name, dataType: e.dataType }));
// Any non-zero uint32 that names this exact list; changes whenever the list does.
const EVENTS_HASH = createHash("sha256").update(JSON.stringify(EVENT_TYPES)).digest().readUInt32BE(0) || 1;

// RFC 4122 v5 in the URL namespace — identical to Python's uuid.uuid5(uuid.NAMESPACE_URL, name).
export function uuidv5(name: string, namespace = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"): string {
  const hash = createHash("sha1")
    .update(Buffer.concat([Buffer.from(namespace.replace(/-/g, ""), "hex"), Buffer.from(name, "utf8")]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const entityUuid = (e: KEntity) => uuidv5(`${e.kind}:${e.id}`);
export const unitEntityId = (propertyId: string, unit: string) => `${propertyId}/${unit}`;

// ---- Ingest --------------------------------------------------------------------------------

async function post(path: "custom" | "in", body: unknown) {
  const res = await fetch(`${INGEST}/${path}`, {
    method: "POST",
    headers: { "k-token": requireEnv("KEEWANO_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Keewano ${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

let registered: Promise<void> | null = null;
export function registerEvents(): Promise<void> {
  if (config.mockKeewano) return Promise.resolve();
  registered ??= post("custom", { customEventsHash: EVENTS_HASH, eventTypes: EVENT_TYPES })
    .then(() => undefined)
    .catch((e) => {
      registered = null; // let the next call retry registration
      throw e;
    });
  return registered;
}

// Throws on failure — used by the seed script, which must know.
export async function sendEvents(entity: KEntity, events: KEvent[]): Promise<{ received: number; accepted: number }> {
  await registerEvents();
  const id = entityUuid(entity);
  return post("in", {
    dataSessionId: randomUUID(),
    batch: 1,
    customEventsHash: EVENTS_HASH,
    installId: id,
    userId: id,
    events: events.map((ev) => {
      const def = EVENTS[ev.name];
      return {
        eventTypeId: def.id,
        dataType: def.dataType,
        timestamp: ev.timestamp ?? null,
        data: def.dataType === "none" ? null : ev.value,
      };
    }),
  });
}

// Must never throw: analytics can't be allowed to break the repair flow.
export async function track(entity: KEntity, events: KEvent[]): Promise<void> {
  if (config.mockKeewano) return;
  try {
    await sendEvents(entity, events);
  } catch (e) {
    console.warn(`[keewano] track ${entity.kind}:${entity.id} (${events.map((ev) => ev.name).join(",")}) failed:`, (e as Error).message);
  }
}

// ---- Query ---------------------------------------------------------------------------------

const g = globalThis as unknown as { __keewanoPool?: Pool };
function db(): Pool {
  g.__keewanoPool ??= new Pool({
    host: "pgsql.keewano.com",
    port: 27543,
    user: requireEnv("KEEWANO_EMAIL"),
    password: requireEnv("KEEWANO_PAT"),
    database: requireEnv("KEEWANO_PROJECT_ID"),
    ssl: true,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return g.__keewanoPool;
}

export async function sql<T>(text: string): Promise<T[]> {
  return (await db().query(text)).rows as T[];
}

// Literals are inlined (simple-query protocol); only allow safe characters.
function lit(value: string): string {
  if (!/^[A-Za-z0-9 _./-]+$/.test(value)) throw new Error(`unsafe SQL literal: ${value}`);
  return `'${value}'`;
}

// Load-bearing: decides who gets called and in what order (orchestrator falls back to ratings on error).
export async function rankProviders(trade: Trade): Promise<ProviderScore[]> {
  if (config.mockKeewano) return mockRank(trade);
  const pool = listProviders().filter((p) => p.trade === trade);
  const byUuid = new Map(pool.map((p) => [entityUuid({ kind: "provider", id: p.id }), p]));
  const rows = await sql<{ user_id: string; answered: string; missed: string; on_time: string; late: string; accuracy: number | string | null }>(`
    SELECT user_id,
           count("CallAnswered") AS answered,
           count("CallMissed") AS missed,
           count("ArrivedOnTime") AS on_time,
           count("ArrivedLate") AS late,
           avg("QuoteAccuracyPct") AS accuracy
    FROM events
    WHERE "Trade" = ${lit(trade)}
    GROUP BY user_id`);
  const stats = new Map(rows.map((r) => [r.user_id, r]));
  return pool
    .map((p) => {
      const r = stats.get(entityUuid({ kind: "provider", id: p.id }));
      const answered = Number(r?.answered ?? 0);
      const missed = Number(r?.missed ?? 0);
      const onTime = Number(r?.on_time ?? 0);
      const late = Number(r?.late ?? 0);
      const accuracy = r?.accuracy != null ? Number(r.accuracy) : 100;
      const answerRate = answered + missed ? answered / (answered + missed) : 0.5;
      const onTimeRate = onTime + late ? onTime / (onTime + late) : 0.5;
      const accuracyScore = Math.max(0, 1 - Math.abs(accuracy - 100) / 50);
      const score = Math.round(100 * (0.45 * answerRate + 0.35 * onTimeRate + 0.2 * accuracyScore));
      const drift = Math.round(accuracy - 100);
      const reason = answered + missed
        ? `Answers ${Math.round(answerRate * 100)}% of calls · on time ${Math.round(onTimeRate * 100)}% · final bill ${drift >= 0 ? "+" : ""}${drift}% vs quote (${answered + missed} past calls)`
        : "No history yet";
      return { providerId: p.id, score, answerRate, onTimeRate, quoteAccuracyPct: Math.round(accuracy), reason };
    })
    .filter((s) => byUuid.has(entityUuid({ kind: "provider", id: s.providerId })))
    .sort((a, b) => b.score - a.score);
}

// Load-bearing: a recurring issue adds a replacement-quote question to every quote call.
export async function unitInsight(propertyId: string, unit: string, trade?: Trade): Promise<UnitInsight> {
  if (config.mockKeewano) {
    const recurring = propertyId === "p2" && trade === "hvac";
    return {
      priorIssuesSameTrade180d: recurring ? 3 : 0,
      recommendReplaceQuote: recurring,
      note: recurring ? `3rd ${trade} issue at ${unit} in 6 months` : "No recent issues of this type at this unit",
    };
  }
  if (!trade) return { priorIssuesSameTrade180d: 0, recommendReplaceQuote: false, note: "Trade unknown" };
  const uid = entityUuid({ kind: "unit", id: unitEntityId(propertyId, unit) });
  // Interval semantics: each IssueReported(trade) event opens a stretch where the column equals that
  // trade, so counting IssueReported inside those stretches counts exactly the matching reports.
  // (count(...) FILTER (...) is rejected by Keewano here: "unsupported aggregate in the SELECT list".)
  const [row] = await sql<{ n: string }>(`
    SELECT count("IssueReported") AS n
    FROM events
    WHERE user_id = ${lit(uid)} AND "IssueReported" = ${lit(trade)} AND event_datetime >= now() - INTERVAL '180 days'`);
  const prior = Number(row?.n ?? 0);
  const recommend = prior >= 2;
  return {
    priorIssuesSameTrade180d: prior,
    recommendReplaceQuote: recommend,
    note: prior
      ? `${prior} earlier ${trade} issue${prior > 1 ? "s" : ""} at ${unit} in the last 6 months${recommend ? ", so we're also asking for a replacement quote" : ""}`
      : `No ${trade} issues at ${unit} in the last 6 months`,
  };
}

export async function metrics(): Promise<{ medianMinutesToBook: { manual: number | null; handled: number | null } }> {
  if (config.mockKeewano) return { medianMinutesToBook: { manual: 2160, handled: 9 } };
  const rows = await sql<{ channel: string; median_min: number | string | null }>(`
    SELECT "Channel" AS channel,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "MinutesToBook") AS median_min
    FROM events
    WHERE "Channel" IS NOT NULL
    GROUP BY channel`);
  const pick = (c: string) => {
    const v = rows.find((r) => r.channel === c)?.median_min;
    return v == null ? null : Math.round(Number(v));
  };
  return { medianMinutesToBook: { manual: pick("manual"), handled: pick("handled") } };
}

function mockRank(trade: Trade): ProviderScore[] {
  return listProviders()
    .filter((p) => p.trade === trade)
    .map((p) => {
      const h = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
      const answerRate = 0.6 + (h % 35) / 100;
      const onTimeRate = 0.7 + (h % 28) / 100;
      const quoteAccuracyPct = 95 + (h % 30);
      const score = Math.round(100 * (0.4 * answerRate + 0.4 * onTimeRate + 0.2 * (1 - Math.abs(quoteAccuracyPct - 100) / 100)));
      return {
        providerId: p.id,
        score,
        answerRate,
        onTimeRate,
        quoteAccuracyPct,
        reason: `Answers ${Math.round(answerRate * 100)}% of calls · on time ${Math.round(onTimeRate * 100)}% · final bill ${quoteAccuracyPct - 100 >= 0 ? "+" : ""}${quoteAccuracyPct - 100}% vs quote (mock)`,
      };
    })
    .sort((a, b) => b.score - a.score);
}
