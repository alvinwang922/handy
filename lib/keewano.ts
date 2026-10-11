import { config } from "./config";
import { listProviders } from "./store";
import type { ProviderScore, Trade, UnitInsight } from "./types";

// Owner: P4. Ingest: REST POST https://api.keewano.com/event/ingress/v1/json/{custom|in} (k-token = project API key),
// installId = UUIDv5 of `provider:<id>` / `unit:<propertyId>/<unit>` / `request:<id>`.
// Query: `pg` → pgsql.keewano.com:27543, user = signup email, password = PAT, db = project UUID, sslmode=require.
// Event registry: spec §9 (confirm dataType names in the Swagger UI before registering).

export interface KEvent {
  name: string;                       // e.g. "QuoteRequested", "CallAnswered"
  value?: string | number | boolean;  // omitted for "none" events
  timestamp?: number;                 // unix seconds; defaults to now (backfill passes explicit times)
}

export type KEntity = { kind: "provider" | "unit" | "request"; id: string };

export async function registerEvents(): Promise<void> {
  if (config.mockKeewano) return;
  throw new Error("TODO(P4): registerEvents()");
}

// Must never throw: analytics can't be allowed to break the repair flow.
export async function track(entity: KEntity, events: KEvent[]): Promise<void> {
  if (config.mockKeewano) return;
  try {
    throw new Error("TODO(P4): track()");
  } catch (e) {
    console.warn(`[keewano] track ${entity.kind}:${entity.id} (${events.map((ev) => ev.name).join(",")}) failed:`, (e as Error).message);
  }
}

// Load-bearing: decides who gets called and in what order. Callers fall back to rating order on error.
export async function rankProviders(trade: Trade): Promise<ProviderScore[]> {
  if (config.mockKeewano) return mockRank(trade);
  throw new Error("TODO(P4): rankProviders() via SQL");
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
  throw new Error("TODO(P4): unitInsight() via SQL");
}

export async function metrics(): Promise<{ medianMinutesToBook: { manual: number; handled: number } }> {
  if (config.mockKeewano) return { medianMinutesToBook: { manual: 2160, handled: 9 } };
  throw new Error("TODO(P4): metrics() via SQL");
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
