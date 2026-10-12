# Handy local app design

> This describes the **Look B app** (`public/app/` + `server/`). In demo mode (`npm run app:demo`) it runs on the simulated stand-ins below. In live mode (`npm run app:live`), `server/integrations/live.js` sends diagnosis, outreach and booking for the demo properties to the Next.js backend (real Claude, Keewano and Dial); see the [README](../README.md).

Build the PRD's complete repair journey for a local hackathon demo. Preserve the original interface, replace browser-only repair state with a persistent backend, and label every sponsor stand-in as a demo. The original single-file UI is `public/index.html`, now wired to the live Next.js backend.

Use Node.js 22.13+ with built-in HTTP, SQLite, and test runner. A framework would add build and dependency setup without improving this small application's current journey. Keep browser assets and application logic in separate files. Bind to the loopback interface; this is a single-user local app without authentication.

The backend owns assessments, discovery, outreach attempts, quotes, explicit approval records, availability, appointments, and ordered events. Each mutation and its events commit together in SQLite. Photos are persisted as size-limited image data, with one bundled sample illustration. Assessments use explicitly labeled demo rules, not an AI model.

Four separate local stand-in adapters expose seeded provider discovery, Dial-style quote and scheduling calls, Keewano-style local event storage and analytics, and Alike-style handoff briefs. (Darwin is not used.) They make no external requests. Missing live credentials must never silently imply a real call, booking, or sponsor integration.

Approval records bind user, quote ID, provider, amount, consent, and timestamp. Scheduling accepts only the approved quote's offered future windows. Rescheduling preserves approval and price. Reopening quotes explicitly clears approval and the appointment. Editing scope invalidates estimates; scheduled repairs require reopening first. Emergency descriptions exit the workflow and cannot request quotes.

Verify the full workflow, invalid transitions, concurrent/repeated approval, malformed input, emergency guards, persistence after restart, event ordering, and local HTTP boundaries. Verify the UI through reporting, comparing, approving, scheduling, role switching, timeline, and analytics.
