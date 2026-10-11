# Engineering designs

- [Dial SMS and call agents](dial-sms-and-calls.md): reviewed app integration, photo sharing during calls, quote and booking workflows, and implementation milestones.
- [Alike development workflow](alike-development-workflow.md): a scoped pilot for carrying decisions and handoffs between coding sessions.

The Dial design has been reviewed against the Next.js scaffold, the [shared types](../lib/types.ts), the PRD and Dial documentation. It preserves existing request routes and identifies additive work for image sharing, approval checks and reliable outcomes. Coordinate changes with the [implementation spec](../docs/superpowers/specs/2026-10-11-handled-design.md) and [team conventions](../CLAUDE.md), including their older statement that SMS is out of scope. Proposed features and hardening work are not claims of completed implementation.
