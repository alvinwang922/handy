# Keewano live Q&A for judges

During judging, ask Claude Code these in plain English. The `keewano` MCP server writes and runs the SQL against project **Handy** (`e811e156-5502-4e60-a79a-0f717171019b`). Each query below was tested against the live project on 2026-10-11; the answers reflect that day's data.

**Data honesty:** provider and unit histories and the "manual" baseline requests are **seeded**, and every seeded entity's first event is `DataSource=seed` (see Q5). Runs that used mock calls are tagged `handled_mock` and never count as real bookings.

**Keewano semantics to remember:** one `events` table; columns are event names; a value holds forward until the next event of that name. Provider names were added after the seed, so look names up separately and join on `user_id` (Q1).

---

### Q1. "Which plumbers can we rely on, and who should we skip?"
This is the ranking Handy uses to decide who gets called.

```sql
-- names
SELECT user_id, "ProviderName" AS name FROM events WHERE "ProviderName" IS NOT NULL GROUP BY user_id, name;
-- reliability
SELECT user_id, count("CallAnswered") AS answered, count("CallMissed") AS missed,
       avg("QuoteAccuracyPct") - 100 AS final_bill_vs_quote_pct
FROM events WHERE "Trade" = 'plumber' GROUP BY user_id;
```

Result: Golden Gate Plumbing answers 95% (+1%), Bay Area Rooter 92% (+2%), Sunset Drain & Sewer 80% (+4%), **Mission Pipe Pros 59% (+18%)**. That's why Handy skips Mission despite its 4.4★ rating.

### Q2. "How long does booking take manually vs with Handy?"
```sql
SELECT "Channel" AS channel, count(DISTINCT user_id) AS requests,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY "MinutesToBook") AS median_min,
       avg("UserActiveSec") AS avg_active_sec
FROM events WHERE "Channel" IS NOT NULL GROUP BY channel ORDER BY channel;
```

Result:
- **manual** (seeded baseline): 120 requests, median **2,225 min (~37 h)** from report to booking, ~107 min of hands-on time each.
- **handled**: appears after a live run (real Dial calls) completes with Keewano enabled. None had been recorded at submission time.
- **handled_mock**: mock-call test runs, shown separately.

### Q3. "Which trades cause the most repeat problems in the same unit?"
```sql
SELECT trade, count(*) AS units_with_repeats FROM (
  SELECT user_id, "IssueReported" AS trade, count("IssueReported") AS n
  FROM events
  WHERE "IssueReported" IS NOT NULL AND event_datetime >= now() - INTERVAL '180 days'
  GROUP BY user_id, trade HAVING count("IssueReported") >= 2
) u GROUP BY trade ORDER BY units_with_repeats DESC;
```

Result: appliance 3 units, plumbing 2, HVAC 2, electrical 1. A repeat issue makes Handy also ask for a replacement quote.

### Q4. "Where do final bills overrun the quote the most?"
```sql
SELECT "Trade" AS trade, avg("QuotePriceCents") / 100 AS avg_quote_usd,
       avg("QuoteAccuracyPct") - 100 AS avg_overrun_pct
FROM events WHERE "Trade" IS NOT NULL GROUP BY trade ORDER BY avg_overrun_pct DESC;
```

Result: HVAC +6.5% (avg quote $349), electrical +6.5% ($251), plumbing +5.4% ($218), appliance +5.0% ($192), handyman +3.3% ($164).

### Q5. "How much of this data is seeded vs live?"
```sql
SELECT "DataSource" AS source, count(DISTINCT user_id) AS entities
FROM events WHERE "DataSource" IS NOT NULL GROUP BY source ORDER BY source;
```

Result: **seed** 167 entities (13 providers, 34 units, 120 baseline requests); **mock** for test runs; **live** for real runs. Ask this one first if a judge questions the data.

---

## Fallback prompts if a judge goes off-script

| Judge asks | Point Claude at |
|---|---|
| "Show me a provider's full history" | `run_script_query` (Lua sees a whole timeline in order) |
| "What changed today?" | Filter with `event_datetime >= now() - INTERVAL '1 day'` |
| "What event types do you track?" | `list_event_types` |
