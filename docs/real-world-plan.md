# From demo to real: providers, users, and the path there

**Status:** draft for the team, 2026-10-11. Nothing here is legal advice; every item marked ⚖️ needs review by a lawyer before launch.

Today Handy works end to end on real infrastructure (Claude, Keewano, Dial), but against **fictional providers on our own phone numbers**, seeded history, a single local user, and one call at a time. This plan covers what changes to call real businesses for real users, in the order we'd do it.

## What's already real, and what isn't

| Area | Today | Needed for real use |
|---|---|---|
| Diagnosis, extraction, approval gate | Real (Claude Opus/Sonnet, evidence checks, quote-bound approval) | Keep; add measured accuracy on real repairs |
| Calls | Real Dial calls, 1 at a time, to our own numbers | Opted-in providers, recording consent, parallel calls, webhooks |
| Providers | 13 fictional listings, seeded Keewano history | Real directory, verified contacts and licenses, consent |
| Users | One local demo user, three fixed properties | Accounts, real addresses, roles (owner, manager, tenant) |
| Data | `data/db.json` + SQLite on one laptop | Hosted Postgres, encryption for addresses and transcripts |
| Scheduling | Spoken slots parsed into windows; no reschedule | Structured windows, reschedule and cancel, reminders |
| Money | None (Sparta deposit agent is separate) | Deposits and refunds, then payouts |

## Phase 0: compliance before any real call (≈1 week)

These block everything else.

1. ⚖️ **Recording consent.** Our agent says it's an AI, but not that the call is **recorded and transcribed**. California generally requires all parties' consent to record a call. Add "This call is recorded and transcribed" to the opening line in `lib/instructions.ts`, and end the call politely if the other side objects. Small change; do it first.
2. ⚖️ **Who we may call, and how.** An AI voice is treated as an "artificial voice" under the TCPA (FCC, 2024), and many small trade businesses answer on mobile numbers. Until counsel says otherwise, only call providers who **opted in** (Phase 1), not businesses scraped from a directory.
3. ⚖️ **Bot disclosure and honesty rules.** Keep the AI disclosure in the first sentence (already enforced), never claim to be a person, and keep quote calls non-binding (already enforced: no booking, no commitment, no exact address).
4. **Data handling.** Transcripts and addresses become personal data: retention limits, deletion on request, encryption at rest, and no transcripts in logs.

## Phase 1: an opted-in provider network (2–4 weeks)

The supply-side idea from the pitch is also the compliance answer: providers join Handy, and joining is consent.

1. **Provider onboarding page**: business name, trade, service area (ZIP list), contact number(s), hours, license number, and explicit consent to receive AI quote and booking calls (stored with timestamp and text).
2. **Verification**: one-time call or SMS code to the number they give; license check against the state board (CSLB in California) where the trade requires it.
3. **The free AI receptionist** (Dial inbound, already prototyped as "Bay Area Rooter"): providers can forward missed calls to it. It's the reason to join, and it answers Handy's own calls with their real prices and openings.
4. **Keewano history from real outcomes**: replace the seed with events from real calls (answered, quoted, showed up on time, final bill vs quote). Until a provider has history, rank by verified license + rating and say "new to Handy" in the reason.
5. **Directory search only as a lead source**: use a places API (e.g. Google Places) to find businesses to **invite**, never to call with AI before they opt in.

**Exit criteria:** 10+ opted-in providers in one metro, each verified, each completing a test quote call.

## Phase 2: real users (2–4 weeks, can overlap Phase 1)

1. **Hosting and accounts**: deploy the Next.js app; sign-in (magic link or passkeys); Look B (`public/app/`) as the UI, wired to the backend as on `feat/lookb-live`, but served by one app instead of two local servers.
2. **Real properties**: users add their own homes or units; addresses encrypted, shared with a provider only after approval (the rule we already enforce in prompts).
3. **Roles**: homeowner, property manager (many properties), tenant (reports issues, can't approve spend), each with their own views (Look B already has owner and manager apps).
4. **Postgres** instead of `data/db.json` and SQLite; one schema for requests, calls, quotes, approvals, bookings and events.
5. **Measured time saved**: the UI timer for hands-on time (currently sends `userActiveSec: 0`), so "photo to booked in under 10 minutes, ~5 clicks" becomes a measured number per user.

**Exit criteria:** 5 pilot users (start with 2–3 property managers) complete real bookings with opted-in providers.

## Phase 3: scale and reliability

1. **Parallel calls**: a paid Dial tier (the free tier allows 2 concurrent calls), `QUOTE_FANOUT=3`, tested live; queue the rest.
2. **Webhooks instead of polling**: Dial call events drive state changes; a background worker owns extraction retries instead of the request-time pump.
3. **Structured availability**: extract windows as start, end and time zone (not phrases), so booking, reminders and `.ics` export never depend on parsing speech.
4. **Reschedule and cancel** through the provider (currently refused for live bookings), with SMS confirmations to the user.
5. **Monitoring**: call success rate, extraction failures, `send_unknown` attempts needing reconciliation, cost per booking.

## Phase 4: money

1. **Deposits and refunds**: the Sparta-tested deposit-settlement agent (retry, stable idempotency key, verify after write) becomes the real refund step when a provider cancels.
2. **Revenue**: per-unit SaaS for property managers plus a fee per booked job (from the pitch); later, payouts to providers.

## Decisions the team needs to make

1. **First customer**: property managers (repeat volume, pay for software) or homeowners (simpler, bigger market)? The pitch says managers first.
2. **First metro**: the Bay Area, where we can recruit providers in person?
3. **Legal review**: who, and when, before the first real call (Phase 0 items 1–3).
4. **One UI**: make Look B the product UI and retire `public/index.html` once Look B is served by the main app.

## Cheap next steps (this week)

- Add the recording disclosure to both call scripts (Phase 0, item 1).
- Merge `feat/lookb-live` after review, and `demo/preflight`.
- Draft the provider consent text and onboarding form (Phase 1, item 1) for legal review.
- Pick 3 friendly local businesses to pilot the AI receptionist.
