# Handy — snap a photo, get it fixed

**Handy turns a photo of a home-repair problem into a booked appointment.** Claude diagnoses the photo, Keewano picks which providers are worth calling, AI voice agents (Dial) call them in parallel for quotes, and once you approve one, Handy calls back to book it.

Built in one day at SpeedHacks (a16z speedrun × SF Tech Week, 2026-10-11).

## The problem

When something breaks at home, the repair itself is rarely the slow part. Finding and coordinating the pro is:

- Homeowners research for **1–5 hours** before they even request a quote, and most collect **3 or more quotes** ([Modernize 2021](https://www.jlconline.com/business/modernize-homeowners-need-help-budgeting-and-rely-heavily-on-online-research_o/), [ArcSite 2022](https://www.arcsite.com/blog/2022-homeowner-survey-report)).
- Property managers report spending **8–22 hours a week** coordinating maintenance ([software-vendor estimates](https://oxmaint.com/industries/property-management/case-study-small-portfolio-manager-saved-20-hours-week-cmms), so treat them as directional).
- Every quote means calling, waiting, repeating the same description, phone tag, then calling back to schedule.

**Our time-saved model (an estimate, not a measurement):** about 30 min of research, plus 3 providers × (3 min to find the number + 8 min on the call + 10 min of phone tag), plus 15 min of scheduling ≈ **108 minutes** of hands-on time per repair. With Handy, the user's hands-on time is a photo, a review and one approval. The backend stores each request's active time (`userActiveSec`) and Keewano tracks minutes-to-book. The UI timer that feeds them is still to come, so the 108-minute figure stays an estimate until we've timed real runs.

## How it works

```
photo + description
   │
   ▼
Claude (Opus 5.5 vision)  ──► diagnosis, trade, urgency, cost range, provider brief (+ DIY plan when safe)
   │   emergencies (gas, fire, sparks, flooding) stop here with safety guidance
   ▼
Keewano  ──► ranks providers from event history (answer rate, on-time rate, final bill vs quote)
   │        and checks the unit's repair history ("3rd plumbing issue → also ask for a replacement quote")
   ▼
Dial  ──► AI voice agents call the top providers in parallel; each discloses it is an AI and never commits
   │
   ▼
Claude  ──► transcript → structured quote (price, fee treatment, availability, scope, evidence)
   │
   ▼
You compare and explicitly approve  ──► Dial booking call ──► scheduled + calendar invite (.ics)
```

## What's real vs simulated (status at submission)

| Piece | Status |
|---|---|
| Photo diagnosis + DIY plan | **Real.** Claude Opus 5.5 vision with schema-validated structured output (`lib/claude.ts`) |
| DIY part search | **Real.** Claude web search returns the 3 best purchase options (`lib/parts.ts`) |
| Provider ranking + unit history | **Real queries** against Keewano. The provider/unit history behind them is **seeded and labeled** (`DataSource=seed`) |
| Dial voice calls | **Real, verified live end to end on the backend:** a quote call (with the photo delivered by MMS), then a booking call through the real `/book` and polling endpoints, confirmed by a controlled provider ([`eng-design/dial-endpoint-handoff.md`](eng-design/dial-endpoint-handoff.md)). Idempotency keys, speaker-separated transcripts, and smoke tests (`npm run smoke:dial`, `npm run smoke:booking`). Parallel live calls are untested, so the live demo uses `QUOTE_FANOUT=1` |
| Photo packets to providers | Backend routes (`packet`, `share-packet`, `messages`) with idempotency and a recipient allowlist. One live photo MMS delivered to a controlled Dial number; live sends are limited to allowlisted numbers |
| Transcript → quote/booking extraction | **Real.** Claude Sonnet 5.5 turns transcripts into schema-validated quotes and booking confirmations, checked against the provider's own words (`lib/evidence.ts`). Mock mode uses fixtures |
| Providers | **Simulated.** The names are fictional, and their phone numbers are teammates' phones and our own AI-receptionist Dial number. We never call real businesses with fake jobs |
| Web UI | Vanilla-JS app (`public/index.html`) served by Next.js. **Diagnosis calls the live API.** The outreach, quote and booking screens still show labeled sample data; the backend behind them is covered by API tests and an end-to-end script |

Anything simulated or seeded is labeled in the app and in the demo video.

## Partner tools

| Partner | How Handy uses it | Why it matters |
|---|---|---|
| **Dial** | Outbound AI quote calls with AI disclosure, booking calls only after approval, an inbound AI-receptionist persona, idempotent call placement, speaker-separated transcripts, and repair photo packets to Dial-to-Dial recipients | It is the core action: Handy makes the phone calls so you don't have to |
| **Keewano** | Typed, append-only event registry (`lib/keewano.ts`); SQL over the Postgres protocol decides **who gets called** and **what to ask**; before/after metrics; live Q&A over MCP | **Load-bearing:** a 4.4★ provider who answers only 59% of calls gets skipped; a unit's repair history adds a replacement-quote question. Example questions: [`docs/keewano-qa.md`](docs/keewano-qa.md) |
| **Sparta Worlds** | [`sparta/`](sparta/README.md): a deposit-settlement agent that refunds a held deposit **exactly once** when a provider cancels, graded in Sparta's local Stripe copy under an injected HTTP 500 | The naive agent passes **3/6** runs; the fixed one (retry, stable idempotency key, verify after write) passes **6/6**. It runs after booking and isn't wired into the app yet |
| **Alike** | Team coordination for our 4 engineers' coding agents: shared decisions anchored to contract files, briefings at session start | Contract changes (for example the call-result schema) reach every teammate's agent before it edits those files |
| Darwin | Prototype only ([`prototypes/darwin-discovery`](prototypes/darwin-discovery/RESULTS.md), `npm run prototype:darwin`); not in the app flow | Two live searches returned no callable home-repair capability: one `no_match`, one directory with `canStartThread=false`. Handy uses its labeled seeded directory until an executable provider-discovery capability exists |

## Safety and trust

- **You approve every commitment.** No booking call goes out without a recorded approval tied to a specific quote (`Approval.quoteCallId`). An inspection-only offer approves the visit fee, never an invented repair total.
- **Unknown is not zero.** A missing price stays `null`, and "$89 fee waived if hired" is not an extra $89 (`feeTreatment`).
- **Calls are honest and bounded.** Every call opens with an AI disclosure. Quote calls never book, commit or share the exact address. Placing a call is idempotent and never auto-retried blindly.
- **Emergencies exit the flow.** A deterministic keyword gate runs regardless of the model's label.
- **No secrets in the repo.** Keys stay in `.env.local` and teammates' numbers in `data/providers.local.json` (both gitignored). Agents are denied reading them (`.claude/settings.json`).

## Run it

Production quote and booking extraction are implemented behind the mock flags. See the [live endpoint handoff](eng-design/dial-endpoint-handoff.md) for configuration, frontend requests and controlled-call validation status. The hosted prototype URL should not be assumed to expose the local backend routes.

```bash
npm install
# npm run dev creates .env.local from .env.example on first run: every MOCK_* = 1, no keys needed (fake calls finish in ~16 s)
# for real Claude diagnosis: set ANTHROPIC_API_KEY and MOCK_CLAUDE=0 in .env.local
npm run dev                  # http://127.0.0.1:3000
npm test                     # vitest
npm run typecheck
```

To go live, flip each `MOCK_*` flag to `0` as you add its keys (see `.env.example`):

| Command | What it does |
|---|---|
| `npm run seed:keewano` | Loads the labeled seed history |
| `npm run try:diagnose` | Tests Claude diagnosis on its own |
| `npm run smoke:dial` | A controlled live Dial quote call |

API: `POST /api/requests` → `POST /api/requests/:id/outreach` → poll `GET /api/requests/:id` → `POST /api/requests/:id/book` → `GET /api/requests/:id/ics`. Also `GET /api/providers` and `GET /api/metrics`.

## Repository map

| Path | What's there |
|---|---|
| `public/index.html` | Web UI |
| `app/api/` | Next.js 16 route handlers |
| `lib/orchestrator.ts` | Call lifecycle: concurrency cap, per-request locking, extraction retries, status machine |
| `lib/claude.ts`, `lib/parts.ts` | Diagnosis and DIY part search |
| `lib/dial.ts`, `lib/instructions.ts`, `lib/communications/` | Calls, call scripts, photo packets |
| `lib/keewano.ts`, `scripts/seed-keewano.ts` | Event registry, queries, seed |
| `lib/types.ts`, `lib/schemas.ts`, `lib/evidence.ts` | Shared contracts and evidence checks |
| `sparta/` | Sparta Worlds deposit-settlement agent and evidence |
| `prototypes/dial-contract/`, `prototypes/darwin-discovery/` | Live Dial contract experiment; Darwin provider-discovery prototype |
| `docs/`, `eng-design/`, `PRD.md` | Spec, engineering designs, product requirements |
| `CLAUDE.md` | Shared conventions for every teammate's coding agent |

## Market and path forward

- **Who we start with:** property managers with 50–500 units. They coordinate repairs every day, repeat the same calls for every unit, and already pay for software.
- **Revenue:** a per-unit SaaS fee for managers, plus a small fee on each booked job.
- **Supply side:** pros get a free AI receptionist (Dial inbound) that answers Handy's quote calls and their own missed calls. That gives them a reason to join, and it turns the business into a two-sided marketplace.
- **Moat:** every call, quote and visit becomes Keewano history (who answers, who shows up on time, who bills what they quoted), so each repair makes the next match better.
- **Then:** homeowners, with the same flow and a consumer price.

## What's next

- Finish the model-based quote extraction and wire the outreach, quote and booking screens to the live API.
- Real provider discovery (directory APIs, plus Darwin once agent coverage exists), with verified contacts and service areas.
- Quote revisions and normalized availability windows (start/end plus time zone), so bookings never depend on phrases like "Tuesday afternoon".
- Payments: the Sparta-tested deposit agent becomes the post-booking money step.

## Team

[@alvinwang922](https://github.com/alvinwang922) · [@rwberndt](https://github.com/rwberndt) · [@hjun-escape](https://github.com/hjun-escape) · Francesco. We built with Claude Code and coordinated our agents through Alike.
