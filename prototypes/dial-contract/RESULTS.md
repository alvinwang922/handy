# Live Dial prototype results

**October 11, 2026 — three actual voice calls between two user-owned Dial agents.** One receiving agent played three fictional plumbers sequentially. These results validate a controlled communication experiment, not independent contractor quotes or production readiness.

The repair brief was a slow kitchen sink drain leak in San Francisco, with pipe material/diameter unknown and no photos sent. The caller received the repair brief; the answering persona alone received its price script. Results below were extracted by assistant review of the actual provider-side transcript, then checked against the Zod contract and exact speaker evidence. Automatic model extraction is not connected.

## Observed results

| Provider persona | Actual terms collected | Missing / qualifications | Duration |
| --- | --- | --- | --- |
| A: fixed estimate | **$220**, labor and standard parts included; **no visit fee**; 90-day workmanship warranty. Openings October 13, 9–11 AM or October 14, 1–3 PM, Pacific. | Description-only, confirmed on arrival. Hidden corrosion/nonstandard piping needs separate approval. | 100 sec |
| B: conditional range | **$180–$280**, labor and standard fittings included; **$89 diagnostic fee waived if hired**; 30-day workmanship warranty. | Availability not collected. Pipe material unknown; onsite inspection may change price. Hit the 180-second cap during a repeated readback. | 180 sec |
| C: inspection only | **$75 inspection visit**; repair price, parts/labor and warranty not yet known. Asked for a close-up image, pipe diameter and more precise leak location. | Availability and fee credit/additivity not established. No repair quote. The caller ended early without collecting those terms. | 151 sec |

All three produced transcripts. Only A supplied all comparison fields. B is a partial repair estimate; C is a partial inspection offer. All were correctly kept separate from booking approval. B's estimated repair cost is not automatically increased by $89. C's missing repair price is not $0 or $75.

The three conversations totalled **7 minutes 11 seconds**; the sequential run, transcript collection and restoration took about **7 minutes 35 seconds**. This is measured execution time, not a demonstrated homeowner time saving: there was no manual baseline, independent provider discovery, photo review, or booking.

## Changes the experiment supports

1. **Separate transport from business outcome.** Dial marked all three calls completed, including the capped call. Persist quote/inspection/decline outcomes and `collectionStatus` independently.
2. **Add `uncollectedFields`.** Distinguish information our agent failed to collect from information the provider requests from the homeowner (`missingInformation`).
3. **Represent fee treatment explicitly.** Confirmed zero, unknown, additional, included and conditional waivers have different meanings.
4. **Retain evidence and versions.** Every extracted result references its request, brief, provider and call. Evidence must come from provider turns; caller suggestions cannot establish terms.
5. **Keep provisional and inspection-only results.** Carry conditions, quote basis and actual photo-review state. Do not turn inspection fees into repair totals.
6. **Carry dates and timezone.** The successful call supplied explicit dates. Empty availability on the other calls stayed empty even though their persona scripts contained sample slots.

## Integration and remaining work

The [return-contract proposal](../../eng-design/dial-call-results-contract.md) assigns our Dial adapter's output to the shared backend, the transcript-to-quote transformation to the AI teammate, and persistence/revisions to the DB owner. The schema and test harness are isolated; shared app contracts and UI have not been changed.

`extraction.ts` supplies a typed extractor interface. The next integration is the AI teammate's model implementation plus stored evidence and idempotent quote revisions. A model's structured answer must pass the same checks; exact excerpt validation alone cannot establish semantic accuracy.

Conversation control also needs another iteration: the agents sometimes spoke over each other, lengthy readbacks displaced unanswered questions, and the first caller's opening disclosure was interrupted. Prefer a short opening, targeted questions for missing terms, one concise readback and an explicit completion checklist before ending. These improvements are recommendations, not a second live-tested prompt version.

This run did not test Darwin discovery, SMS/MMS, photo-review confirmation, human recipients, automatic model extraction, scheduling, parallel dialing, dispatch-crash recovery or production authentication. No contractors were contacted and no appointments or purchases were made.

## Verification and private artifacts

- Three real calls completed and three reviewed quote results passed evidence/schema validation.
- The original answering agent instruction was restored and reread successfully at run completion.
- Run ID: `2026-10-11T20-51-53-942Z`. Raw transcripts, call IDs, attempts, reviewed/validated quotes and restoration evidence are retained in the ignored `.local/<run-id>/` directory.
- API key stored only in ignored `.local/.env` with file mode `0600`; account number mapping also stays local. Neither belongs in GitHub or browser code.
- After rebasing onto the latest main, all **46 repository tests passed**, including 16 prototype cases. TypeScript checking, scoped ESLint and the three-job dry run also passed. Contract tests cover path/eligibility gates, immutable input, provider-side evidence, stale versions, inspection fees, unknown versus zero fees, conditional waivers and partial collection.
