# Live Dial endpoint handoff

The server implements quote calls, production transcript extraction, exact-quote approval and a separate booking call. The same Anthropic account used for diagnosis supplies transcript extraction; Dial supplies the voice conversation. A successful call alone never sets `scheduled`.

## Run the backend

Use the same checkout/data directory for the server and test harness. The repository currently documents a local Next.js server; its static hosted prototype URL is not a deployed API base URL.

Configure `.env.local` privately (never commit values): `DIAL_API_KEY`, `DIAL_FROM_NUMBER_ID`, `DIAL_RECEPTIONIST_NUMBER_ID` for the controlled test, and `ANTHROPIC_API_KEY`. Controlled provider mappings live in ignored `data/providers.local.json`.

For live voice and extraction set **all three** `MOCK_DIAL=0`, `MOCK_CLAUDE=0`, `MOCK_CLAUDE_EXTRACT=0`. `MOCK_CLAUDE=1` also forces simulated extraction. Keewano may remain mocked independently. With two Dial-owned numbers on the same two-concurrent-call account, set `MAX_CONCURRENT_CALLS=1` because an outbound conversation also uses the receiver's incoming leg. `QUOTE_FANOUT=1` is appropriate for that controlled test; production fanout defaults to three eligible providers.

```bash
npm install
npm run dev  # http://127.0.0.1:3000; restart after changing environment flags
```

No webhook or public callback is required for this polling path. The UI must poll while the queue is active. A public/multi-user deployment additionally needs the authentication, durable storage and worker changes already tracked in the coverage audit.

## Frontend / app contract

| Action | Endpoint | Result |
| --- | --- | --- |
| Submit assessment input | `POST /api/requests` multipart intake | Request and diagnosis; image/description work remains P2/P3. |
| Request quotes | `POST /api/requests/:id/outreach` | Ranked eligible seeded providers and persisted quote attempts. |
| Progress and quotes | `GET /api/requests/:id` about every 3 seconds | Call status, `calls[].quoteResult`, compatible `quote`, and `quoteRevision`. |
| Approve and schedule | `POST /api/requests/:id/book` with the JSON below | Persisted approval and booking attempt. |
| Booking outcome | Continue polling the request | `scheduled` only after provider evidence confirms an allowed window and unchanged terms; otherwise notice/reconciliation. |

```json
{
  "providerId": "<selected provider id>",
  "quoteCallId": "<selected quote call id>",
  "quoteRevision": "<revision displayed to the user>",
  "slots": ["October 13, 2026, 9–11 AM Pacific", "October 14, 2026, 1–3 PM Pacific"],
  "accessNote": "<user-approved access instructions>",
  "consentText": "<explicit approval of the displayed provider, terms and offered windows>"
}
```

The sample dates illustrate the contract; use actual future windows for the user's request. An inspection-only quote approves only its visit fee. Hourly rates without a total cap are rejected. Changed quote revisions require renewed approval. An uncertain call placement or unreadable booking must be reconciled before a second call.

## Controlled live acceptance

First run the quote harness against the two owned Dial numbers (`npm run smoke:dial`). Then use its persisted `req_live_...` request. The booking harness requires a real saved transcript and re-extracts it with the production model; it has no fixture fallback. Start the local backend with matching live flags, then:

```bash
HANDY_LIVE_DEMO=1 HANDY_APP_URL=http://127.0.0.1:3000 \
MOCK_DIAL=0 MOCK_CLAUDE=0 MOCK_CLAUDE_EXTRACT=0 BOOKING_CALL_MAX_SEC=180 \
npm run smoke:booking -- --approve --request-id=<controlled quote request id>
```

`--approve` authorizes only a fictional agent-to-agent test appointment. The harness exercises the real `/book` and request polling routes, verifies quote terms/window evidence, and restores the receiver persona and local provider mappings. `--observe` inspects an existing attempt; `--recover` restores private test state after interruption. Preserve the ignored recovery journal until restoration verifies.

## Current evidence and limits

- Dial transport has controlled live quote evidence. The integrated call stored $220 with no visit fee and incomplete availability.
- Production extractors are implemented and tested with mocked Anthropic responses, including refusal/truncation, bad evidence, stale IDs and ambiguous booking outcomes. Production model execution and live booking acceptance still need an environment with the Anthropic secret.
- The full simulated journey returns three quotes and confirms the selected provider's second offered window; it also rejects changed terms and outside-window confirmations.
- Darwin prototype live searches did not yield a usable contractor route. Keep the labeled seeded directory for the deadline.
- SMS summaries/photo review, rescheduling, exact calendar export and public deployment hardening remain separate gaps in the [PRD coverage audit](dial-prd-coverage.md).
