# Live Dial contract prototype

Isolated proof of the assessment → provider → real Dial call → transcript → validated quote contract. It does not change the frontend, shared model, orchestrator, or another teammate's unfinished communications code.

The caller and receptionist are two existing Dial numbers belonging to the same account. Three **fictional provider personas** run sequentially on the same answering number: flat repair estimate, conditional range/fee, and inspection-only. These are real voice calls, not three independent contractors or market quotes. The recipient's previous inbound instruction is restored and checked after the run.

## Run

Node 22+ and the repository dependencies are required. Commands from the repository root:

```sh
node --import tsx prototypes/dial-contract/runner.ts
node node_modules/vitest/vitest.mjs run tests/dial-contract-prototype.test.ts
node --import tsx prototypes/dial-contract/runner.ts --live
```

The first command validates three jobs without contacting Dial. `--live` places real calls (maximum 180 seconds per call) after verifying both expected number IDs belong to the account, are voice-enabled, and are not already in a call. Put the two approved account agent IDs in ignored `prototypes/dial-contract/.local/numbers.json` as `{"coordinatorId":"YOUR_CALLER_AGENT_ID","providerId":"YOUR_ANSWERING_AGENT_ID"}`. Provide `DIAL_API_KEY` through the environment or the hidden interactive prompt. Optional `--save-key` stores it with mode 0600 in the ignored `.local/.env`; subsequent runs load it. Never put a key in command arguments or a public artifact.

Run outputs live in ignored `.local/<run-id>/`. The runner records an attempt before dispatch, uses a unique Dial idempotency key, never automatically retries placement, and distinguishes `awaiting_extraction` from a quote. A timeout or ambiguous dispatch must be reconciled before another run. A hard process kill can bypass cleanup: use the saved `restore.json` to restore the provider prompt and check Dial for any remaining call before retrying. Keep that file private.

## Proposed shared handoff

- `RepairBrief`: schema and brief versions, observed symptoms, existing `Diagnosis`, recommended path, requester role, city/ZIP/timezone, reference time, photo references and unresolved user questions.
- `ProviderTarget`: stable provider ID, trade, service-area match and verified contact. The prototype resolves the actual phone from an authorized account number, not model output. Discovery is seeded for this experiment.
- `QuoteJob`: immutable prompt/snapshot hash, request/brief/provider IDs, attempt and idempotency IDs, quote-only purpose and call duration cap.
- `Transcript`: Dial call ID, direction, termination status, raw transcript and speaker-separated turns. For an outbound call, `user` is the provider side, even if it is another AI.
- `ExtractedQuote`: existing `Quote` plus outcome, collection completeness, uncollected fields, fee treatment, provider requests for missing information, quote basis, photo-review state and field-level provider evidence. `collectionStatus` is independent of Dial's transport status: a completed call can leave availability uncollected.

`extraction.ts` is P2's integration point. Their extractor receives the actual transcript, diagnosis, location/timezone and reference time. It must return the `ExtractedQuoteSchema` format; missing values stay null. The validator verifies IDs and exact provider evidence, rejects negative/reversed prices, keeps inspection fees separate from repair totals, and checks fee-waiver conditions. Exact excerpts do not by themselves prove semantic correctness; the extractor/reviewer still has to interpret them accurately.

No independent extraction API key is needed to run calls. Until P2's model extractor is connected, a reviewer can prepare `.local/<run-id>/reviewed-quotes.json`, explicitly label `extractionMethod: "human_review"` or `"assistant_review"` as appropriate, then run:

```sh
node --import tsx prototypes/dial-contract/review.ts <run-id>
```

That validates reviews against recorded provider turns and saves `validated-quotes.json`. It does not use persona answers as extracted evidence. The prototype must not be described as automatic end-to-end quote extraction until a model extractor is connected and tested.

## Boundaries

Photo/media delivery, automatic provider discovery, actual homeowner jobs, booking, payments, and the UI are outside this experiment. A description-only call cannot establish photo review. Fixture price ranges are not an approved spending budget. DIY, emergency, unresolved clarification, wrong trade, or unverified service area/contact all block dispatch.

One caller plus one answering agent allows sequential scenario coverage, not three simultaneous independent provider calls. Do not use this single-process prototype as a production job queue. Keep existing app API shapes and USD field units when integrating; add new fields and matching Zod validators in coordination with the shared-contract owners.

See [live results](RESULTS.md) and the [shared backend / database handoff proposal](../../eng-design/dial-call-results-contract.md).
