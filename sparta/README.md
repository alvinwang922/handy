# Handy deposit settlement agent, tested in Sparta Worlds

**What it does.** Handy turns a photo of a home repair into a booked appointment. Dial calls collect quotes, the resident approves one, and a Dial booking call schedules it. The next money step is a deposit charged to hold the slot. This agent runs after the booking call. Claude (`claude-sonnet-5-5`) reads the call transcript and returns a structured decision. The code then refunds the deposit **exactly once** if the provider cancelled the job, and changes nothing if the visit only moved. It uses plain Stripe REST, so under Sparta it hits the local Stripe copy (a "world") and in production it would hit Stripe. It is not wired into the Handy app yet.

**Why Sparta.** "The agent said it refunded" is not proof. Sparta grades the Stripe records left behind, under an injected connector failure, in a fresh world every run.

## Run it (Node ≥ 24, no Sparta account, no Stripe account)
```sh
cd sparta && npm ci            # sparta_worlds@0.9.0-beta.3 (event pin), @anthropic-ai/sdk@0.133.0
npm run before    # v0 naive agent, mission provider-cancelled, --scenario interruption  -> FAIL
npm run after     # v1 fixed agent, same mission, inputs and scenario                     -> PASS
npm run evidence  # full before/after matrix + Sparta HTML reports into evidence/rerun-<time>/
npm run open      # browse the worlds and grade in Sparta's local UI
```
Claude access: put `ANTHROPIC_API_KEY` in `projects/handy-deposits/.env` to call the Anthropic API through the official SDK. Without a key the agent falls back to the Claude Code CLI (`claude -p --model claude-sonnet-5-5`, no tools). **The recorded runs below used that fallback.** Each decision cost about $0.003 (17 decisions, $0.07 total).

## Seed, missions and checks (`projects/handy-deposits/`)
Seed: two units' paid deposits. Unit 4B `ch_handy_4b_deposit` is $96.25 for AquaFix job J-4B-17. Unit 7A `ch_handy_7a_deposit` is $110.00 for RotoKing job J-7A-09.

| Mission | Transcript says | Declarative checks (hidden from the agent) |
|---|---|---|
| `provider-cancelled` | "we have to cancel that job… we won't be able to do it at all" | 4B `amount_refunded` = 9625 · exactly 1 refund created · 0 charges created · 7A charge unchanged · change scope = refund + 4B charge only |
| `rescheduled-not-cancelled` | "We have to cancel Tuesday… Thursday at 9 a.m. works" | 4B `amount_refunded` = 0 · **forbidden `POST /v1/refunds`** (a rejected attempt still fails) · 0 refunds · 7A unchanged · 0 charges updated |

## Before vs after (same seed hash `359fc3ed…`, input digest `4c591659…`, checks and `--scenario interruption`)
The interruption scenario returns one HTTP 500 on the first connector request.

| Run | v0 `naive-agent.mjs` | v1 `settlement-agent.mjs` |
|---|---|---|
| provider-cancelled, no scenario | PASS 5/5 checks | (not run) |
| provider-cancelled, interruption | **FAIL**: refunded-in-full and exactly-one-refund fail (3/5 pass). The agent exited 0 and told the resident "Your deposit has been refunded." | **PASS 5/5**: GET 500 → retry → refund → re-read verifies |
| rescheduled-not-cancelled, interruption | PASS 5/5 | PASS 5/5 |
| `--all --runs 3`, interruption | **3/6 runs pass** (all 3 cancellations fail) | **6/6 runs pass** |

**What v0 got wrong:** a single `fetch` POST to `/v1/refunds` with no retry and no Idempotency-Key. It never checked `res.ok`, and fetch does not throw on a 500, so it reported a refund that never happened. It passes the happy-path test.
**The fix (v1):** (1) bounded retry (4 attempts, backoff) on 429, 5xx and network errors, reusing one Idempotency-Key per mutation (`handy-deposit-refund:{jobId}:{chargeId}`); (2) re-read the charge first: it must match the job's customer and amount, and is skipped if already refunded; (3) refund only if Claude's JSON says `refund_deposit` **and** `job_still_happening=false`, with an evidence quote; (4) re-read after the refund and exit non-zero unless `amount_refunded == amount`.

**Evidence** (`evidence/`): `before/*.json` and `after/*.json` (Sparta evidence), matching `.html` files (rendered by Sparta's own report function, the same one behind the UI's HTML download) and `.txt` terminal output. Also `summary.json` (pass/fail for every check), `decisions.jsonl` (every Claude decision with its quote and cost), and `00-gonogo-builtin-duplicate-charge.json` (the first graded run, on the unchanged starter).

## Honest limitations
- The reschedule trap did **not** fool the loose v0 prompt: Claude answered "NO, rescheduled" in 4/4 runs. v1's structured decision is extra safety, not a measured improvement. The measured improvement is failure handling.
- Starter mode only supports the built-in `interruption` scenario (a single 500 on the first request; custom scenarios are rejected). In v1 that 500 hits the pre-read GET, so the retry path runs, but the refund POST's Idempotency-Key replay is never exercised. Injected errors are rejected before the handler, so this models a rejected request, not a lost response.
- The SDK path (`client.beta.messages.create`, JSON-schema output, `fallbacks: "default"`) was checked only against a local stub, never the live API.
- Sparta's Stripe copy covers a verified subset of Stripe, not full parity. Evidence is unsigned, so rerun it rather than trusting it.
