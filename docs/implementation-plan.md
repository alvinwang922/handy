# Handy Implementation Plan

**Goal:** A working local app implementing the PRD journey with a persistent backend and labeled demo adapters.

**Architecture:** Node HTTP API serves the existing interface and owns the repair state machine. SQLite stores repair aggregates and ordered events. Separate sponsor adapters produce deterministic demo outputs.

**Tech stack:** Node.js 22.13+, JavaScript ES modules, built-in SQLite and node:test, HTML and CSS.

**Spec:** [design.md](design.md), [PRD.md](../PRD.md).

## Global constraints

- Loopback only; no outbound calls, messages, or bookings.
- No package dependencies or external credentials required.
- Explicit approvals enforced on the server.
- All sponsor outputs and assessments labeled demo.

## Review focus

- Changing scope must invalidate old approvals and quotes.
- Invalid amounts and missing consent must never approve a quote.
- Scheduling must reject invented, expired, or past windows.
- Gas, fire, flooding, and electrical danger must block normal outreach.
- Restarting must preserve repair data and ordered events.

## Tasks

- [ ] Backend: create `server/store.js`, `server/repairs.js`, `server/validation.js`, and `server/integrations/*.js`; test the state machine in `tests/repairs.test.js` before implementation.
- [ ] API: create `server/app.js` and `server/index.js`; test JSON errors, approval gates, persisted events, and static-file boundaries in `tests/http.test.js`.
- [ ] Browser: retain `prototype/index.html`; split assets into `public/`; route mutations through `public/api.js`; render persisted events, failures, handoffs, and analytics.
- [ ] Documentation and verification: document run commands, API and integration contracts; run `npm test`, `npm run check`, and the browser journey.

## Acceptance commands

```sh
npm test
npm run check
npm start
```

The browser flow at `http://127.0.0.1:4173` must end with a persisted demo appointment; direct scheduling without approval must return HTTP 409.
