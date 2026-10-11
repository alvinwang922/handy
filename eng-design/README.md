# Engineering designs

- [Dial SMS and call agents](dial-sms-and-calls.md): reviewed app integration, photo sharing during calls, quote and booking workflows, and implementation milestones.
- [Dial/outreach PRD coverage](dial-prd-coverage.md): ownership, implemented versus live-tested behavior, booking-extractor handoff and remaining requirements.
- [Live Dial endpoint handoff](dial-endpoint-handoff.md): environment setup, frontend requests, production extraction and controlled scheduling acceptance.
- [Darwin provider discovery](darwin-provider-discovery.md): P1-owned prototype, capability-to-provider handoff and integration acceptance gates.
- [Alike development workflow](alike-development-workflow.md): a scoped pilot for carrying decisions and handoffs between coding sessions.

The Dial design has been reviewed against the Next.js scaffold, the [shared types](../lib/types.ts), the PRD and Dial documentation. It preserves existing request routes and identifies additive work for image sharing, approval checks and reliable outcomes. Coordinate changes with the [implementation spec](../docs/superpowers/specs/2026-10-11-handled-design.md) and [team conventions](../CLAUDE.md), including their older statement that SMS is out of scope. Proposed features and hardening work are not claims of completed implementation.
