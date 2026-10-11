// Owner: P4. Backfills ~60 days of LABELED SEEDED history (every seeded entity's first event is
// DataSource="seed") so Keewano's queries have signal on demo day. Run ONCE: re-running duplicates history.
// Run: npm run seed:keewano   (events take ~5 min to become queryable)
import { sendEvents, type KEntity, type KEvent } from "../lib/keewano";
import { listProperties, listProviders } from "../lib/store";
import type { Trade } from "../lib/types";

// Deterministic PRNG so the seeded story is reproducible.
let state = 20261011;
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const chance = (p: number) => rand() < p;

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;

// answer = P(picks up a quote call), onTime = P(arrives in the window), drift = final bill vs quote (%).
// Mission Pipe Pros is rated 4.4★ but rarely answers: rating order would call it, Keewano order won't.
const PROFILES: Record<string, { answer: number; onTime: number; drift: number; jobs: number }> = {
  plumb_rooter: { answer: 0.93, onTime: 0.95, drift: 2, jobs: 24 },
  plumb_golden: { answer: 0.88, onTime: 0.92, drift: 4, jobs: 18 },
  plumb_sunset: { answer: 0.82, onTime: 0.88, drift: 5, jobs: 14 },
  plumb_mission: { answer: 0.41, onTime: 0.76, drift: 18, jobs: 17 },
  hvac_breeze: { answer: 0.9, onTime: 0.93, drift: 3, jobs: 20 },
  hvac_comfort: { answer: 0.82, onTime: 0.9, drift: 5, jobs: 15 },
  hvac_polar: { answer: 0.45, onTime: 0.7, drift: 20, jobs: 12 },
  handy_fixit: { answer: 0.91, onTime: 0.94, drift: 1, jobs: 26 },
  handy_hammer: { answer: 0.85, onTime: 0.88, drift: 4, jobs: 16 },
  handy_doors: { answer: 0.5, onTime: 0.75, drift: 15, jobs: 11 },
  elec_spark: { answer: 0.87, onTime: 0.92, drift: 3, jobs: 14 },
  elec_volt: { answer: 0.78, onTime: 0.85, drift: 8, jobs: 10 },
  appl_repair: { answer: 0.8, onTime: 0.86, drift: 7, jobs: 9 },
};
const BASE_PRICE: Record<Trade, number> = { plumber: 220, hvac: 340, handyman: 160, electrician: 260, appliance: 190, locksmith: 140, other: 200 };

function providerHistory(trade: Trade, p: { answer: number; onTime: number; drift: number; jobs: number }): KEvent[] {
  const t0 = NOW - 60 * DAY;
  const events: KEvent[] = [{ name: "DataSource", value: "seed", timestamp: t0 - 2 }, { name: "Trade", value: trade, timestamp: t0 - 1 }];
  const starts = Array.from({ length: p.jobs }, () => Math.floor(between(t0, NOW - DAY))).sort((a, b) => a - b);
  for (const t of starts) {
    events.push({ name: "QuoteRequested", timestamp: t });
    if (!chance(p.answer)) {
      events.push({ name: "CallMissed", timestamp: t + 45 });
      continue;
    }
    events.push({ name: "CallAnswered", timestamp: t + 45 });
    const quoteUsd = Math.round(BASE_PRICE[trade] * between(0.8, 1.25));
    events.push({ name: "QuotePriceCents", value: quoteUsd * 100, timestamp: t + 240 });
    if (!chance(0.6)) continue;
    events.push({ name: "JobBooked", timestamp: t + 3_600 });
    events.push({ name: chance(p.onTime) ? "ArrivedOnTime" : "ArrivedLate", timestamp: t + 2 * DAY });
    events.push({ name: "QuoteAccuracyPct", value: Math.max(70, Math.round(100 + p.drift + between(-6, 6))), timestamp: t + 2 * DAY + 7_200 });
  }
  return events;
}

// The demo units get a recurring-issue story; synthetic units add volume.
function unitHistories(): { entity: KEntity; events: KEvent[] }[] {
  const out: { entity: KEntity; events: KEvent[] }[] = [];
  const add = (propertyId: string, unit: string, issues: { trade: Trade; daysAgo: number }[]) =>
    out.push({
      entity: { kind: "unit", id: `${propertyId}/${unit}` },
      events: [
        { name: "DataSource", value: "seed", timestamp: NOW - 200 * DAY },
        ...issues.sort((a, b) => b.daysAgo - a.daysAgo).map((i) => ({ name: "IssueReported" as const, value: i.trade, timestamp: NOW - i.daysAgo * DAY })),
      ],
    });
  add("p1", "Main home", [{ trade: "plumber", daysAgo: 150 }, { trade: "plumber", daysAgo: 41 }, { trade: "handyman", daysAgo: 90 }]);
  add("p2", "Unit 2B", [{ trade: "hvac", daysAgo: 160 }, { trade: "hvac", daysAgo: 95 }, { trade: "hvac", daysAgo: 20 }]);
  add("p2", "Unit 2A", [{ trade: "electrician", daysAgo: 70 }]);
  add("p3", "Unit 1", [{ trade: "handyman", daysAgo: 30 }]);
  const trades: Trade[] = ["plumber", "hvac", "handyman", "electrician", "appliance"];
  for (let i = 1; i <= 30; i++) {
    const n = Math.floor(between(0, 4));
    add(`seed${(i % 6) + 1}`, `Unit ${i}`, Array.from({ length: n }, () => ({ trade: trades[Math.floor(between(0, trades.length))], daysAgo: Math.floor(between(5, 175)) })));
  }
  return out;
}

// Before Handy: the manager's phone-and-voicemail process (labeled seeded baseline).
function manualRequests(count: number): { entity: KEntity; events: KEvent[] }[] {
  return Array.from({ length: count }, (_, i) => {
    const t = Math.floor(between(NOW - 60 * DAY, NOW - 2 * DAY));
    return {
      entity: { kind: "request", id: `seed-manual-${i + 1}` },
      events: [
        { name: "DataSource", value: "seed", timestamp: t },
        { name: "Channel", value: "manual", timestamp: t + 1 },
        { name: "UserActiveSec", value: Math.round(between(70, 150) * 60), timestamp: t + 2 },
        { name: "MinutesToBook", value: Math.round(between(600, 4_300)), timestamp: t + 3 },
      ],
    };
  });
}

async function main() {
  const providers = listProviders();
  const jobs: { entity: KEntity; events: KEvent[] }[] = [
    ...providers.filter((p) => PROFILES[p.id]).map((p) => ({ entity: { kind: "provider" as const, id: p.id }, events: providerHistory(p.trade, PROFILES[p.id]) })),
    ...unitHistories(),
    ...manualRequests(120),
  ];
  console.log(`Seeding ${jobs.length} entities (${jobs.reduce((n, j) => n + j.events.length, 0)} events) for ${listProperties().length} demo properties…`);
  let accepted = 0;
  let rejected = 0;
  for (let i = 0; i < jobs.length; i += 8) {
    const results = await Promise.allSettled(jobs.slice(i, i + 8).map((j) => sendEvents(j.entity, j.events)));
    for (const r of results) {
      if (r.status === "fulfilled") accepted += r.value?.accepted ?? 0;
      else {
        rejected++;
        console.error("batch failed:", (r.reason as Error).message);
      }
    }
  }
  console.log(`Done: ${accepted} events accepted, ${rejected} batches failed. Queryable in ~5 minutes.`);
  if (rejected) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
