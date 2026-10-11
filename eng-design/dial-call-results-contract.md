# Dial call results: shared backend and database proposal

**Status:** Minimum contract integrated in the app, October 11, 2026. Validated by the [isolated live-call prototype](../prototypes/dial-contract/README.md) and app tests; durable database migration remains future work.

The Dial integration returns results to **Handy's backend/orchestrator**. The backend stores the call evidence, invokes the AI teammate's extractor, validates its answer, and stores a structured quote. The UI reads the saved request. The assessment agent does not need to stay running while providers answer, and the voice agent does not write directly to the database.

```mermaid
sequenceDiagram
    participant O as Shared backend
    participant D as Our Dial adapter
    participant DB as App database
    participant AI as AI teammate's extractor
    participant UI as UI
    O->>DB: Save attempt + approved brief version
    O->>D: Start quote call
    D-->>O: Dial call ID
    O->>DB: Save call ID and progress
    O->>D: Poll call / retrieve transcript
    D-->>O: CallResult (transport + evidence)
    O->>DB: Save evidence before extraction
    O->>AI: Brief + provider + CallResult
    AI-->>O: QuoteResult (facts + supporting excerpts)
    O->>O: Validate references, evidence and terms
    O->>DB: Save quote revision + extraction status
    UI->>O: Existing GET /api/requests/:id
    O-->>UI: Saved comparisons and missing information
```

## Ownership

| Owner | Produces / owns |
| --- | --- |
| Us: discovery and Dial | Eligible provider target; call dispatch, polling, speaker-separated transcript and transport errors. Discovery supplies verified contact and service-area eligibility; diagnosis alone does not. |
| AI teammate | Repair assessment before outreach; structured quote extraction after outreach, including unknowns and evidence. This is an explicit proposed ownership agreement. |
| Shared backend / DB teammate | Persist attempts before calling, join records, invoke extraction, validate results, deduplicate updates, manage revisions and expose request results. The schema owner chooses physical tables/columns. |
| UI teammate | Display saved estimates, fees, conditions, partial results and availability; collect approval against a specific quote revision. |

For the current single Next.js app, use typed function calls and the existing `lib/orchestrator.ts` flow. No new public callback endpoint or separate microservice is required. If Dial webhooks are added later, they update the same backend records; they do not bypass extraction or validation.

## 1. CallResult — what our service sends back

Extend the existing `CallRecord`; preserve its current names and state values. These are logical fields, not a demand for a new table:

| Field | Meaning |
| --- | --- |
| `schemaVersion: 1` | Contract version. |
| `callRecordId`, `requestId`, `providerId` | Handy's local IDs; allocate the call record before contacting Dial. |
| `briefVersion`, `briefHash` | Immutable input actually used for this call. The prototype hash includes the provider and purpose as well as the brief. Map `briefVersion` to the team's repair-packet version rather than inventing two competing versions. |
| `purpose: "quote" \| "booking"` | Keep quote collection and approved scheduling separate. |
| `dialCallId: string \| null` | External ID; null until acknowledged. |
| `dispatchState` | `queued`, `dispatching`, `accepted`, `send_unknown`, or `failed`. The adapter may retry once with the same persisted idempotency key; ambiguity after that becomes `send_unknown` and does not redial. |
| `state`, `terminationType` | Existing Dial transport fields. A completed call is not proof of a quote or booking. |
| `startedAt`, `endedAt`, `durationSec` | Known timestamps/duration, otherwise null. |
| `transcriptStatus` | `pending`, `ready`, or `unavailable`; may become ready after the call ends. |
| `transcript`, `transcriptTurns[]` | Raw text and `{speaker, text, startMs, endMs}`. On an outbound call, Dial's `user` speaker is the provider. |
| `transcriptHash` | Identify the specific evidence version consumed by extraction. |
| `error` | Safe structured stage/code/message; preserve existing display text if needed. Never include credentials. |

Persist transport results even for busy, unanswered or failed calls. Such results must not create an empty or zero-dollar quote. Keep an extraction state separately: `not_started`, `pending`, `validated`, or `failed`, with attempt count and a safe error. Retrying extraction uses the saved evidence and never redials.

## 2. QuoteResult — what the extractor returns

Reuse `Quote` from `lib/types.ts` and the executable [prototype schema](../prototypes/dial-contract/contract.ts). Preserve USD units and nullable values. The prototype already validates these additions:

| Field | Meaning |
| --- | --- |
| `requestId`, `providerId`, `briefVersion`, `dialCallId` | Correlate the quote to the exact repair, provider and conversation. |
| `extractionMethod` | `model`, `deterministic_mock`, `assistant_review`, or `human_review`; do not represent mock or reviewed output as autonomous model extraction. |
| `outcome` | `quote_received`, `inspection_only`, `needs_information`, or `declined`. |
| `collectionStatus`, `uncollectedFields[]` | `complete` or `partial`, and what the conversation did not establish, such as availability. |
| `quote` | Existing price low/high, pricing type, visit fee, availability, inspection flag, scope, warranty, conditions, notes and confidence. |
| `feeTreatment` | `none`, `additional`, `included`, `waived_if_hired`, or `unknown`. A conditional waiver is not an extra charge. |
| `missingInformation[]` | Information the provider requested, such as pipe material or a close-up photo. Distinct from fields our agent failed to collect. |
| `quoteBasis` | `description_only`, `inspection_required` or `photos_and_call`; the last requires reviewed photos and provider evidence. |
| `photoReviewState` | Shared `unknown`, `not_reviewed`, `reviewed` enum. A reviewed result needs `photo_review` evidence. |
| `evidence[]` | `{field, turnIndex, providerText}` where `turnIndex` must identify a provider turn. Validation replaces model-normalized text with the canonical stored turn text. Caller suggestions cannot establish a price. |

The DB owner should add **`quoteId`, `revision`, `createdAt`, `extractorVersion`, and source references** when moving beyond the embedded store. The current approval binds to `quoteCallId` and a revision derived from the transcript/job hash. Source references identify the call/transcript version and provider turn; later SMS evidence can identify a message ID. These references establish provenance but do not replace semantic review.

Keep the existing `availability: string[]` for compatibility. Before scheduling, add normalized windows with start/end timestamps and the property's IANA timezone; a string such as “Tuesday afternoon” cannot establish a confirmed booking. The brief must include timezone and a reference date for relative expressions.

### Example: the actual partial-result shape from the live test

```json
{
  "requestId": "req_example",
  "providerId": "provider_b",
  "briefVersion": "brief_1",
  "dialCallId": "call_example",
  "extractionMethod": "assistant_review",
  "outcome": "quote_received",
  "collectionStatus": "partial",
  "uncollectedFields": ["availability"],
  "quote": {
    "priceLowUsd": 180,
    "priceHighUsd": 280,
    "pricingType": "flat",
    "visitFeeUsd": 89,
    "availability": [],
    "needsInspection": true,
    "scope": "Standard sink drain repair including labor and standard fittings",
    "warranty": "30-day workmanship warranty",
    "conditions": "Visit fee waived if repair proceeds; estimate provisional until inspection",
    "notes": "Call ended before availability was collected",
    "confidence": 0.9
  },
  "feeTreatment": "waived_if_hired",
  "missingInformation": ["Existing drain pipe material"],
  "quoteBasis": "description_only",
  "photoReviewState": "not_reviewed",
  "evidence": [
    {"field": "price", "turnIndex": 4, "providerText": "flat repair price estimate, one hundred and eighty to two hundred and eighty dollars."},
    {"field": "fee", "turnIndex": 6, "providerText": "Diagnostic visit fee, eighty nine dollars if they decline the repair. Waived if they proceed with the repair."},
    {"field": "conditions", "turnIndex": 6, "providerText": "Diagnostic visit fee, eighty nine dollars if they decline the repair. Waived if they proceed with the repair."},
    {"field": "scope", "turnIndex": 8, "providerText": "Labor plus standard drain fittings included."},
    {"field": "warranty", "turnIndex": 10, "providerText": "Workmanship warranty, thirty days."},
    {"field": "missingInformation", "turnIndex": 12, "providerText": "Do you know if the existing drain piping under the sink is mostly PVC plastic?"}
  ]
}
```

IDs and turn indexes are illustrative; terms and excerpts came from a real call with a fictional provider persona. Actual indexes must refer to the stored source turns. This is a provisional $180–$280 repair estimate, not $269–$369 and not a scheduled appointment.

## 3. Suggested database relationships and update rules

`RepairRequest 1 → many CallAttempts`, `Provider 1 → many CallAttempts`, `CallAttempt 1 → many QuoteRevisions`. A quote revision can reference additional messages when SMS is integrated. The schema owner can use tables or embedded records; for now these can remain additive fields on `RepairRequest.calls[]` and its quote data.

- Make non-null `dialCallId` unique. Link through Handy's local call ID when dispatch acknowledgment is uncertain.
- Save raw evidence before extraction. Deduplicate extraction by call ID + transcript hash + extractor version; refreshing a request must not create duplicate quotes.
- Preserve quote revisions. A new assessment or changed terms cannot silently overwrite the version approved by the user.
- Keep null as unknown and zero as explicitly free. An inspection-only result has null repair prices even when its visit fee is known.
- Preserve partial results. Unanswered availability stays empty; never copy a slot from a persona fixture or another provider.
- Store transcripts privately and return a suitable UI projection through the existing request API. Keep communication evidence in the app database; Keewano's registered analytics events are a separate concern unless the DB owner explicitly chooses it for operational storage.
- Scheduling consumes an explicit approval tied to `quoteId`/revision and permitted windows. Quote success alone must never dispatch a booking call.

**Next integration step:** connect P2's production extractor to the implemented `QuoteResult` contract, then exercise one controlled end-to-end app call. The current embedded store already persists the fields on `RepairRequest.calls[]`; the DB owner can map them to durable tables without changing the handoff.
