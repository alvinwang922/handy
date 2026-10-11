// Owner: P4. Backfills ~60 days of LABELED SEEDED history so Keewano queries have signal on demo day.
// Run: npm run seed:keewano   (events take ~5 min to become queryable — seed by 1:30 PM)
//
// TODO(P4):
// 1. POST https://api.keewano.com/event/ingress/v1/json/custom  { customEventsHash, eventTypes }  (registry: spec §9)
// 2. For each provider in data/providers.json: Trade context event, then per past job QuoteRequested →
//    CallAnswered(bool) → QuotePriceCents → JobBooked → ArrivedOnTime(bool) → QuoteAccuracyPct, timestamps over 60 days.
// 3. ~40 units: IssueReported(trade) history; make p2 / "Unit 2B" a recurring hvac unit (3 issues in 180 days).
// 4. ~120 past requests with Channel("manual") and MinutesToBook in the 1–3 day range (phone tag) for the before/after.
// installId = UUIDv5 of `provider:<id>` / `unit:<propertyId>/<unit>` / `request:<id>` (use the same helper as lib/keewano.ts).
console.log("TODO(P4): implement the Keewano seed — see comments in scripts/seed-keewano.ts");
