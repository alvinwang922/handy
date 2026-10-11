# Dial/outreach PRD coverage

Reviewed October 11, 2026 against [the PRD](../PRD.md), the integrated backend and the controlled-call evidence. **This is a coverage audit, not a claim that the full PRD is delivered.** No frontend changes are included.

## Ownership and data flow

**P1 owns provider discovery (including Darwin), contact eligibility, calling and scheduling.** P2 sends the assessment; it does not need to search for contractors. Shared app code adds request identity, role, property location and photo references to form `RepairBrief`. P1 resolves a separate `ProviderTarget`, then freezes a `QuoteJob` before each call. Keewano ranks eligible providers; it is not a business directory.

The current app builds the brief internally from `RepairRequest`; there is no new network endpoint or need for P2 to synchronously await a phone call. `POST /api/requests/:id/outreach` starts the work. Dial results are persisted, P2 extracts from saved evidence, and the UI polls the same request. The DB owner controls physical storage. Phone destinations stay server-side.

## Coverage and remaining work

“Implemented” below means present in this backend. Simulated tests and controlled live evidence are listed separately.

| PRD requirement | State and evidence | Owner / remaining acceptance |
| --- | --- | --- |
| Relevant nearby providers, ideally three | Seeded trade/service-area filtering and Keewano/rating ranking implemented; three-provider simulated journey passes. Darwin is not yet connected. | **P1:** discovery prototype next; persist source/contact/coverage provenance and deduplicate. Search capability discovery is not a verified contractor list. |
| Correct locality and contact | Controlled local number overrides gate live demo calls. Location currently comes from global configuration; coverage is a city substring match. | **P1 + app/DB:** property-specific city/postal code/timezone; actual contact and service-area evidence. An override does not prove business identity. |
| Dynamic repair-specific persona | Frozen brief/prompt, role, scope, uncertainty, questions and dates implemented; controlled voice call exercised. | **P1:** no additional deployed agent per provider is needed; build instructions per job. |
| Multiple quote calls | Persisted queue, per-request concurrency, IDs, transcript turns, extraction retry and unknown-dispatch reconciliation implemented. Simulated journey returns three distinct quotes. | **P1:** account-wide capacity and durable background processing. Real acceptance so far used controlled recipients, not discovered businesses. |
| Comparable estimates | Shared `QuoteResult` validates price, fee/waiver, scope, availability, warranty, partial results and evidence. Production model extraction is implemented and a real model replay of the controlled $220/no-fee transcript passed. | **P2:** maintain extraction and semantic grounding; **P3:** real comparison cards and provisional labels. Inspection fees must not be compared with repair totals. |
| Return and store outcomes | Operational call/quote results saved before UI reads; `call.quote` stays compatible and `quoteRevision` binds terms/evidence. | **DB/glue:** durable storage and actors; **P4:** ordered analytics events. Analytics is separate from operational truth. |
| Clarification and follow-up | Missing information/uncollected fields represented. Required-question gate exists but builder currently supplies an empty list. | **P2 + P1 + P3:** distinguish blocking from optional questions; collect answers/photos, version brief, follow up with same provider. |
| Explicit quote approval | Exact call/revision required live; stale terms, nonquotes and uncapped hourly offers blocked. Inspection approval uses visit fee. | **P3:** submit displayed IDs/revision and explicit consent. **DB/auth:** actual actor and durable audit. New scope/photos must trigger renewed review. |
| Multiple windows and approved second call | `BookingJob` freezes quote, fee, amount, scope, windows, reference date and timezone. Production booking extractor is implemented; simulated journey books only selected provider in second offered window. | **P1/P2:** controlled live acceptance and continued extraction validation. Strings preserve API compatibility but need canonical future start/end timestamps. |
| Confirmed appointment only | Deterministic validation requires allowed slot, unchanged terms and provider-turn evidence live. Changed/ambiguous outcomes stay unscheduled; extraction retries do not redial. | **P2:** semantic evidence correctness. **P1:** live test covering no match, changed fee/scope, refusal, interruption and unknown outcome. |
| Confirmation and calendar | Request can persist selected provider and confirmed slot. | **P3:** actual confirmation screen. **Shared calendar:** existing ICS guesses date/duration; replace with canonical dates/timezone before calling it exact. |
| Written quote and booking summaries | No automatic summary workflow yet. | **P1:** persisted SMS intent/status, idempotency, channel eligibility, replies and delivery reconciliation. SMS failure must not undo a confirmed voice booking. |
| Photos during quote calls | Preview/send/history routes, packet versions and restricted transport implemented and mock tested. No live photo review acceptance. | **P1:** Context MCP tool and inbound/delivery reconciliation; **P3:** UI wiring. Intake 5 MB WebP/GIF support exceeds packet's one JPEG/PNG ≤1 MB; compression/conversion and metadata removal needed. |
| No answer → retry/SMS/next provider | Dispatch uncertainty and extraction retries implemented; new outreach round excludes previously called providers. | **P1:** bounded no-answer policy, cooldown, SMS fallback, callback correlation and account-wide 402/429 pause. POST retry is not a no-answer retry. |
| Reschedule without changed approved terms | No reschedule/cancel operation yet. | **P1/glue + P2 + P3:** preserve existing appointment until replacement confirmed; changed provider/price requires new approval. |
| Mark repair complete | Outside voice-call implementation; request lifecycle currently stops at scheduled. | **P3/DB:** explicit completion action/state/event. |
| Emergencies and disclosure | Emergency outreach blocked. Quote prompt discloses AI, prohibits commitment and omits structured address/access. Booking adds address after approval. | **P1/shared:** reviewed provider-safe free text, disclosure ledger, authentication and media metadata removal before public multi-user operation. |
| History, time savings and truthful demo | Call durations and some Keewano events/metrics exist. Seeded/mock paths are explicit in backend. | **P4/P3:** distinguish mock/live, partial/complete and inspection/repair; first usable quote, approval funnel and median active time. 108-minute baseline is an estimate; 50% savings is a target, not measured evidence. |
| DIY → professional escalation | Assessment can still carry a professional brief. | **P2/P3:** DIY itself is outside P1; if included, carry attempted steps/parts and escalation reason into the next brief. |

## Immediate handoff to P2 and P3

`extractQuote` receives request/provider/call IDs, frozen diagnosis, reference date/timezone, transcript and speaker turns. Return `QuoteResult` with evidence indices; unknown values remain null. The deterministic development extractor is not the production implementation.

`extractBooking` now receives `BookingExtractionInput`, including the **frozen approved quote and fee conditions**, approval basis/amount, exact quote revision, offered windows, timezone, reference date and transcript turns. Confirm only when the provider agrees to one offered window with unchanged terms. Return that original window string, not a paraphrase, and evidence for both `slot` and `terms`. A definite negative outcome requires provider `outcome` evidence; ambiguous calls must fail extraction and remain in reconciliation.

Example production booking result (illustrative, not a live appointment):

```json
{
  "confirmed": true,
  "slot": "2026-10-14 13:00–15:00 America/Los_Angeles",
  "outcome": "confirmed",
  "termsUnchanged": true,
  "notes": "Provider accepted the second offered window and approved repair terms.",
  "evidence": [
    { "field": "slot", "turnIndex": 1, "providerText": "Wednesday October 14 from one to three Pacific works." },
    { "field": "terms", "turnIndex": 3, "providerText": "Yes, the same 220 dollars including labor and standard parts, no visit fee." }
  ]
}
```

P3 reads `call.quoteResult`, `call.quoteRevision`, booking status and notices from the existing request API. Booking POST sends `{providerId, quoteCallId, quoteRevision, slots, accessNote, consentText}`. The backend persists approval before placing the second call. Live booking remains unavailable with the simulated extractor.

## Test evidence and next sequence

- `tests/dial-journey.test.ts`: fake transport with production booking validation; three quotes, two concurrent calls per request, exact approval, second-window booking, stale approval and changed/outside-window terms rejected.
- `tests/communications/booking-contract.test.ts`: live evidence requirements and ambiguous negative outcomes.
- `tests/orchestrator.test.ts`: persist-before-dispatch, extraction without redial, unknown-call reconciliation and legacy snapshot handling.
- [Controlled quote evidence](../prototypes/dial-contract/RESULTS.md) and [integrated acceptance](dial-sms-and-calls.md#12-integrated-backend-acceptance-and-remaining-handoffs): real calls to controlled personas; no live SMS/photo-review/booking acceptance.

The booking handoff and Darwin prototype are merged. Production extraction is now implemented; a live quote-model replay passed. Current work is the controlled full quote→MMS→approval→booking acceptance described in the [endpoint handoff](dial-endpoint-handoff.md). Image receipt is separate from active-agent photo review. Messaging automation and rescheduling remain explicit deliverables.
