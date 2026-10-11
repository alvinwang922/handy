# Handled — Design Spec

**Date:** 2026-10-11 · **Event:** SpeedHacks (deadline 5:00 PM PDT) · **Team:** 4 engineers + Claude Code

> "Snap a photo. It's handled." — turns a photo of a home-maintenance issue into a scheduled repair:
> diagnose → AI calls providers for quotes → compare → approve → AI books it.

## 1. Goal and judging alignment

| Criterion (weight) | How Handled scores |
|---|---|
| Problem & time saved (40%) | Finding pros, calling around, phone tag, scheduling: hours → minutes. We **measure** the user's active time in-app and compare to a labeled survey-based baseline. |
| Technical execution (25%) | Real Claude vision diagnosis, real Dial phone calls in parallel, real transcript → structured quote extraction, real Keewano queries driving decisions. |
| Market (15%) | Property-manager wedge → two-sided marketplace (pitch handled later). |
| Originality (10%) | Agent-to-agent: one provider answers with its own AI receptionist. Keewano history changes *what* we ask (repair vs. replace). |
| Demo (10%) | Photo → three phones ring → quote table fills → approve → booked. |

Partner prizes targeted: **Dial** (outbound quote + booking calls, inbound AI receptionist), **Keewano** (load-bearing ranking + unit history + before/after metric).

## 2. Primary user and MVP flow

Primary user: **property manager** (homeowners get the same flow minus property/unit).

1. **Submit** — photo + short description + property/unit.
2. **Diagnose** — Claude (vision) returns a `Diagnosis`: likely issue, cause, trade, urgency, on-site-inspection flag, cost range, a job brief to read to providers, questions to ask. Keewano unit history (`UnitInsight`) is passed in; recurring issues → also request a replacement quote.
   - `urgency = "emergency"` → **stop**: show safety guidance, no outreach (emergencies out of scope).
3. **Pick providers** — Keewano SQL ranks providers of that trade (answer rate, on-time rate, quote accuracy). Top 3 shown with a one-line reason.
4. **Quote calls** — Dial places up to 3 calls in parallel (respecting `MAX_CONCURRENT_CALLS`; extras queue locally). Each agent discloses it is an AI calling for the PM company, reads the job brief, asks price / pricing type / two earliest windows / inspection needed, **never commits**.
5. **Extract** — on call end, Claude turns the transcript into a `Quote`.
6. **Compare** — table: price, pricing type, availability, rating, Keewano reliability, notes; "Recommended" badge + reason.
7. **Approve & book** — user picks a provider and offers 2–3 time windows → Dial booking call → Claude extracts `BookingResult` → status `scheduled` → `.ics` download.
8. **Track** — status timeline + **time-saved meter** (measured user active time vs. labeled baseline).

**Out of scope (say so in demo):** emergencies, payments, real provider directory (seeded instead), provider-side app, auth/multi-user, SMS (Dial SMS is Dial-to-Dial only).

## 3. Real vs. simulated (must be stated in the video)

| Real | Simulated (labeled) |
|---|---|
| Claude diagnosis of a real photo | Provider directory (seeded JSON) |
| Live Dial phone calls + transcripts | Providers = teammates' phones + one AI receptionist (2nd Dial number) + one no-answer |
| Claude quote/booking extraction | ~60 days of Keewano history (seed script), live demo events are real |
| Keewano SQL queries at decision time | "Typical time" baseline = survey-based estimate |

We do **not** call real businesses with fake jobs.

## 4. Architecture

```
Next.js (App Router, TypeScript) — single app, run locally for the demo
 ├─ app/                    pages: /  ·  /new  ·  /requests/[id]   (UI polls every 3s)
 ├─ app/api/                route handlers (below)
 ├─ lib/types.ts            shared contracts (section 5)            — owner: scaffold
 ├─ lib/store.ts            JSON-file store (data/db.json)          — owner: scaffold
 ├─ lib/claude.ts           diagnose / extractQuote / extractBooking — owner: P2
 ├─ lib/dial.ts             placeCall / getCall (+ MOCK mode)       — owner: P1
 ├─ lib/instructions.ts     Dial call prompts (quote/booking/receptionist) — owner: P1
 ├─ lib/orchestrator.ts     outreach, refresh (poll+extract+queue), book — owner: P1
 ├─ lib/keewano.ts          register, track, rankProviders, unitInsight, metrics (+ MOCK) — owner: P4
 ├─ scripts/seed-keewano.ts 60-day labeled history                  — owner: P4
 ├─ scripts/setup-receptionist.ts  sets inboundInstruction on 2nd Dial number — owner: P1
 └─ data/                   providers.json, properties.json; providers.local.json (phones, gitignored)
```

- **No webhooks / no public URL:** call progress is read by polling `GET /api/v1/calls/{id}` inside `GET /api/requests/[id]`.
- **Libraries:** `@getdial/sdk`, `@anthropic-ai/sdk`, `pg` (Keewano speaks Postgres wire protocol), `zod` (validate Claude JSON), Tailwind.
- **Models:** `claude-opus-5-5` for photo diagnosis; `claude-sonnet-5-5` for transcript extraction (speed). Read the `claude-api` skill before writing `lib/claude.ts`.
- **MOCK mode** (`MOCK_DIAL=1`, `MOCK_KEEWANO=1`): fake calls progress Queued → Ringing → In-Progress → Terminated over ~20 s and return fixture transcripts from `fixtures/transcripts/`; Keewano returns static rankings. Lets the frontend and orchestration be built before any keys work.

## 5. Shared contracts (`lib/types.ts`)

```ts
export type Trade = "plumber" | "electrician" | "handyman" | "hvac" | "appliance" | "locksmith" | "other";

export interface Property { id: string; name: string; address: string; units: string[] }

export interface Provider {
  id: string; name: string; trade: Trade;
  phone: string;               // E.164 — merged from data/providers.local.json (gitignored)
  rating: number; reviewCount: number; serviceArea: string;
}

export interface Diagnosis {
  title: string;               // "Leaking P-trap under kitchen sink"
  likelyCause: string;
  trade: Trade;
  urgency: "emergency" | "soon" | "routine";
  needsOnsiteInspection: boolean;
  costRangeUsd: [number, number];
  jobBrief: string;            // 2–3 sentences the voice agent reads to providers
  questionsForProviders: string[];
  confidence: number;          // 0–1
}

export interface UnitInsight {
  priorIssuesSameTrade180d: number;
  recommendReplaceQuote: boolean;
  note: string;                // "3rd water-heater issue in 6 months"
}

export interface ProviderScore {
  providerId: string; score: number;        // 0–100
  answerRate: number; onTimeRate: number; quoteAccuracyPct: number;
  reason: string;                            // one line shown in UI
}

export interface Quote {
  priceLowUsd: number | null; priceHighUsd: number | null;
  pricingType: "flat" | "hourly" | "visit_fee_plus" | "unknown";
  visitFeeUsd: number | null;
  availability: string[];      // human-readable windows, e.g. "Tue 9–11am"
  needsInspection: boolean;
  notes: string;
  confidence: number;          // 0–1; < 0.5 → UI shows "unclear — view transcript"
}

export interface BookingResult { confirmed: boolean; slot: string | null; notes: string }

export type CallPurpose = "quote" | "booking";
export type CallState = "queued_local" | "Queued" | "Ringing" | "In-Progress" | "Terminated";
export type TerminationType = "completed" | "busy" | "no-answer" | "failed" | "canceled";

export interface CallRecord {
  id: string;                  // our id
  dialCallId: string | null;
  providerId: string;
  purpose: CallPurpose;
  state: CallState;
  terminationType: TerminationType | null;
  durationSec: number | null;
  transcript: string | null;
  quote: Quote | null;
  booking: BookingResult | null;
  startedAt: string | null; endedAt: string | null;
}

export type RequestStatus =
  | "diagnosed" | "emergency" | "quoting" | "quotes_ready" | "booking" | "scheduled" | "failed";

export interface RepairRequest {
  id: string; propertyId: string; unit: string;
  description: string; photoPath: string;
  status: RequestStatus;
  diagnosis: Diagnosis | null;
  unitInsight: UnitInsight | null;
  rankedProviders: ProviderScore[];
  calls: CallRecord[];
  selectedProviderId: string | null;
  offeredSlots: string[];
  scheduledSlot: string | null;
  timeline: { status: RequestStatus; at: string }[];
  userActiveSec: number;       // measured client-side: form time + review/approve time
  createdAt: string;
}
```

## 6. API routes

| Route | Does | Returns |
|---|---|---|
| `POST /api/requests` (multipart: `photo`, `description`, `propertyId`, `unit`, `userActiveSec`) | save photo → `keewano.unitInsight` → `claude.diagnose` → status `diagnosed` or `emergency` → track events | `RepairRequest` |
| `POST /api/requests/[id]/outreach` | `keewano.rankProviders(trade)` → top 3 → `orchestrator.startQuoteCalls` → `quoting` | `RepairRequest` |
| `GET /api/requests/[id]` | `orchestrator.refresh`: poll non-terminated calls; on `Terminated`+transcript → extract quote/booking; start queued calls when capacity frees; all quote calls done → `quotes_ready`; booking confirmed → `scheduled`; track events | `RepairRequest` |
| `POST /api/requests/[id]/book` (`{ providerId, slots: string[], userActiveSec }`) | booking call → `booking` | `RepairRequest` |
| `GET /api/requests/[id]/ics` | calendar file for `scheduledSlot` | `text/calendar` |
| `GET /api/requests` | list (home page, grouped by property) | `RepairRequest[]` |
| `GET /api/metrics` | `keewano.metrics()` + local time-saved | `{ medianMinutesToBook: { manual, handled }, userActiveSecAvg, baselineMin }` |

## 7. Module interfaces

```ts
// lib/claude.ts (P2)
diagnose(input: { photo: Buffer; mediaType: string; description: string; unitInsight: UnitInsight | null }): Promise<Diagnosis>
extractQuote(input: { transcript: string; diagnosis: Diagnosis }): Promise<Quote>
extractBooking(input: { transcript: string; offeredSlots: string[] }): Promise<BookingResult>

// lib/dial.ts (P1)
placeCall(input: { to: string; instruction: string; maxSec: number }): Promise<{ dialCallId: string }>
getCall(dialCallId: string): Promise<{ state: CallState; terminationType: TerminationType | null;
  durationSec: number | null; transcript: string | null }>

// lib/instructions.ts (P1)
quoteInstruction(p: Provider, d: Diagnosis, u: UnitInsight | null, company: string): string
bookingInstruction(p: Provider, d: Diagnosis, q: Quote, slots: string[], access: string, company: string): string
receptionistInstruction(persona: { name: string; trade: Trade }): string

// lib/orchestrator.ts (P1)
startQuoteCalls(req: RepairRequest, providers: Provider[]): Promise<RepairRequest>
refresh(req: RepairRequest): Promise<RepairRequest>
startBookingCall(req: RepairRequest, providerId: string, slots: string[]): Promise<RepairRequest>

// lib/keewano.ts (P4)
registerEvents(): Promise<void>
track(entity: { kind: "provider" | "unit" | "request"; id: string }, events: KEvent[]): Promise<void>  // fire-and-forget, never throws
rankProviders(trade: Trade): Promise<ProviderScore[]>
unitInsight(propertyId: string, unit: string, trade?: Trade): Promise<UnitInsight>
metrics(): Promise<{ medianMinutesToBook: { manual: number; handled: number } }>
```

## 8. Dial call rules (`lib/instructions.ts`)

- **Quote call** (`maxSec` 240): open with "Hi, I'm an AI assistant calling on behalf of {company} property management to get a quote." Read `jobBrief`. Ask: price or range + how they price (flat / hourly / visit fee); two earliest windows this week; whether they need to inspect first; if `recommendReplaceQuote`, also ask replacement price. Give neighborhood only, not the exact address. Never commit or book; say "we'll call back to confirm." Voicemail → short message with callback number, hang up.
- **Booking call** (`maxSec` 180): reference the earlier quote; offer windows in order; confirm one; confirm price range; give address + unit + access note; read back the confirmed window.
- **AI receptionist** (2nd Dial number, ideally on a teammate's separate Dial account to avoid the concurrency cap): persona "Bay Area Rooter", plumbing, quotes $180–250 flat with $89 visit fee waived if hired, offers Tue 9–11am / Wed 1–3pm, asks one clarifying question; accepts an offered window on booking calls.
- Dial free tier: 5-min calls, 2 concurrent → redeem `DIAL_FOR_SPEEDHACKS` credit first; keep `MAX_CONCURRENT_CALLS` configurable (default 2).

## 9. Keewano events and queries (`lib/keewano.ts`, P4)

Ingest via REST `POST https://api.keewano.com/event/ingress/v1/json/{custom|in}` (`k-token` = project API key); entity `installId` = UUIDv5 of `provider:<id>` / `unit:<propertyId>/<unit>` / `request:<id>`. Query via `pg`: `pgsql.keewano.com:27543`, user = signup email, password = PAT, db = project UUID, `sslmode=require`, single `events` table, no JOINs.

**Source of truth: `EVENTS` in `lib/keewano.ts` (append-only; ids 2000–2023).** Outcomes are separate `none` events (`CallAnswered` / `CallMissed`, `ArrivedOnTime` / `ArrivedLate`) because Keewano columns hold their value forward; `count()` per entity then gives clean rates. Every entity's first event is `DataSource` (`seed` | `live`), so a judge can query exactly how much data is seeded.

Decisions driven by queries (load-bearing): **provider ranking** (who gets called, in what order) and **unit insight** (adds the replacement-quote question). Before/after: median `MinutesToBook` by `Channel`. Seed history: ~8 providers × 60 days, ~40 units, ~120 requests (`manual` channel, long phone-tag times) — **labeled seeded**. Events take ~5 min to become queryable → seed by 1:30.

## 10. Time-saved meter

`userActiveSec` = client-measured time on `/new` form + time on review/approve. Baseline (labeled estimate, cite in README: Modernize 2021 & ArcSite 2022 homeowner surveys; PM vendor estimates 8–22 h/week): research 30 min + 3 providers × (find 3 + call 8 + phone tag 10 min) + scheduling back-and-forth 15 min ≈ **108 min**. Display: "Your time: Xm Ys · Typical: ~1h 48m (estimate)".

## 11. Error handling

- `no-answer` / `busy` / `failed` → card shows status; flow continues when the rest finish.
- `Terminated` but transcript `null` → keep polling up to 60 s, then mark "transcript unavailable".
- `Quote.confidence < 0.5` → "Unclear quote — view transcript" (still shown, not ranked).
- Dial `402` (credit) / `429` (concurrency) → keep call `queued_local`, surface a banner.
- `urgency = emergency` → status `emergency`, safety message, no calls.
- `needsOnsiteInspection` → banner; quote calls ask for inspection-visit price.
- `keewano.track` never throws (logging must not break the flow); query failure → fall back to rating-sorted providers and show "ranking unavailable".

## 12. Testing

- `vitest`: `extractQuote` / `extractBooking` against fixture transcripts (P2); instruction builders include required disclosures (P1).
- MOCK mode end-to-end click-through (P3).
- **1:45 checkpoint (real):** real photo → diagnosis → one real Dial call to a teammate → quote appears in UI.

## 13. Build plan (4 engineers)

**Claude Code (13:00–13:15):** scaffold Next.js + Tailwind, `lib/types.ts`, `lib/store.ts`, module stubs matching section 7, MOCK mode + 3 fixture transcripts, seed `data/*.json`, `.env.example`, `.gitignore`. Then pair wherever blocked.

| Engineer | Owns | First milestone (by 13:45) |
|---|---|---|
| **P1 — Calls** | `lib/dial.ts`, `lib/instructions.ts`, `lib/orchestrator.ts`, `scripts/setup-receptionist.ts` | real quote call to a teammate returns transcript |
| **P2 — AI** | `lib/claude.ts`, fixtures, prompt tuning on real transcripts | diagnosis JSON from a real photo; quote extracted from fixture |
| **P3 — Frontend** | `/`, `/new`, `/requests/[id]`: upload + preview, diagnosis card, provider picks w/ reasons, live call cards, comparison table, approve + slots, timeline, time-saved meter | full click-through in MOCK mode |
| **P4 — Data** | `lib/keewano.ts`, `scripts/seed-keewano.ts`, `GET /api/metrics`, `data/providers.json` | events registered + seed sent; ranking SQL returns rows |

Timeline: 13:00–13:15 scaffold + keys · 13:45 checkpoint · 13:45–15:00 parallel calls, Keewano live, booking, polish · 15:00–15:15 bug bash · **15:15 feature freeze** → demo/pitch prep (team) · **16:30 submit**.

**Stretch (in order):** tenant access-window call · retry no-answer · mid-call availability check via Dial Context MCP.

## 14. Config

`.env.local` (gitignored): `ANTHROPIC_API_KEY`, `DIAL_API_KEY`, `DIAL_FROM_NUMBER_ID`, `KEEWANO_API_KEY`, `KEEWANO_PAT`, `KEEWANO_EMAIL`, `KEEWANO_PROJECT_ID`, `MOCK_DIAL`, `MOCK_KEEWANO`, `MAX_CONCURRENT_CALLS`, `COMPANY_NAME`.
Gitignored data: `data/providers.local.json` (teammates' phone numbers), `data/db.json`, `data/uploads/`. The repo will be shared with judges — no secrets or personal numbers in it.
