# Handy — shared guide for every teammate's Claude Code

@AGENTS.md

SpeedHacks hackathon, Sunday 2026-10-11. **Submission deadline 5:00 PM PDT · feature freeze 3:15 PM.**
Working and honest beats clever. Keep changes small and inside your own files.

## What we're building
Photo of a home issue → Claude diagnosis → Keewano ranks providers → parallel Dial AI quote calls →
Claude extracts quotes → user compares and **explicitly approves** → Dial booking call → scheduled (+ .ics).
- Product requirements: `PRD.md`
- Technical design and contracts: `docs/superpowers/specs/2026-10-11-handled-design.md`

## Commands
- `cp .env.example .env.local` once. With every `MOCK_*=1`, the full flow runs with no keys (fake calls finish in ~16 s).
- `npm run dev` → http://localhost:3000 (UI = `public/index.html`, API = `app/api/**`)
- `npm test` (vitest, `tests/`) · `npm run typecheck`
- `npm run setup:receptionist` (P1) · `npm run seed:keewano` (P4)

## Ownership — edit only your own files; ask in team chat before touching anyone else's
| Path | Owner |
|---|---|
| `public/index.html` (vanilla-JS UI prototype; replace its simulated `submitRequest`/`startOutreach`/`book`/`transcript` with API calls) | P3 frontend |
| `lib/dial.ts`, `lib/instructions.ts`, `scripts/setup-receptionist.ts` | P1 calls |
| `lib/claude.ts`, `fixtures/transcripts/` | P2 AI |
| `lib/keewano.ts`, `scripts/seed-keewano.ts`, `app/api/metrics/` | P4 data |
| `lib/types.ts`, `lib/schemas.ts`, `lib/store.ts`, `lib/orchestrator.ts`, `app/api/requests/**` | shared glue: announce every change |

## Contracts
- `lib/types.ts` is the contract between modules. Make **additive** changes only (new nullable fields), mirror them in `lib/schemas.ts`, and tell the team.
- Validate every JSON object Claude returns with the zod schemas in `lib/schemas.ts` before using it.
- `keewano.track()` must never throw. If ranking fails, the orchestrator falls back to rating order. Keep it that way.
- API: `POST /api/requests` (multipart: photo, title, description, propertyId, unit, room, userActiveSec) → `POST /api/requests/:id/outreach` → poll `GET /api/requests/:id` every 3 s → `POST /api/requests/:id/book` `{providerId, slots[], accessNote, userActiveSec}` → `GET /api/requests/:id/ics`. Also `GET /api/requests`, `GET /api/requests/:id/photo`, `GET /api/metrics`.
- Status flow: `diagnosed → quoting → quotes_ready → booking → scheduled` (also `emergency`, `failed`).
- Property ids `p1`–`p3` match the prototype UI.

## Rules that protect the demo
1. **No secrets or real phone numbers in git.** Keys go in `.env.local`; teammates' numbers go in `data/providers.local.json` (both gitignored, and the repo is public). Never print them in a session: Alike uploads tool output unredacted. `.claude/settings.json` denies reading these files; don't work around it (no `printenv`, no `grep KEY`).
2. Every voice call discloses it is an AI. Quote calls never book, commit or give the exact address. No booking call without the approval record the book route writes.
3. Never call real businesses with fake jobs. Demo providers are teammates plus our AI-receptionist number. Label simulated or seeded data in the UI and the video.
4. Emergencies (gas, fire, sparks, flooding) exit the flow with safety guidance.
5. Dial: the free tier allows 5-min calls and 2 concurrent calls. SMS only works Dial-to-Dial, so don't build SMS to real phones. `POST /calls` is not idempotent: never auto-retry it.
6. Next.js 16: route-handler `params` is a Promise (`const { id } = await ctx.params`). Don't enable `cacheComponents`. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.
7. Claude: use `claude-opus-5-5` for photo diagnosis and `claude-sonnet-5-5` for transcript extraction. Load the `claude-api` skill before writing SDK code, and downscale large photos first.

## Git
Commit small and often. Run `git pull --rebase` before every push. Never force-push `main`.

## Alike (team coordination for our coding agents)
If the `alike` MCP server is connected: at session start, link the session to your branch or module (`resolve_work_item`). When you change a contract in `lib/types.ts`, `lib/schemas.ts` or the API, call `record_decision` with a `paths` anchor and tell the affected owner via `inform_colleague`. Ask blocking cross-module questions with `ask_colleague`. Always confirm with your human before sending anything to a teammate.

## Partner prizes (status)
Dial and Keewano are core and must stay load-bearing; the Keewano event registry lives in `EVENTS` in `lib/keewano.ts` and is append-only.
Alike: team coordination (above). Sparta: `sparta/` (deposit settlement agent graded in Sparta Worlds; GO; its own package.json, run from that folder). Darwin is skipped unless its "Act" access is granted.
