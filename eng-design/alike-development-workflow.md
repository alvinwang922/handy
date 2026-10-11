# Alike in Handy development

**Recommendation:** use Alike for engineering decisions and session handoffs, outside the homeowner repair workflow. This is a proposed pilot, not an installed integration.

## What we verified

The [Alike site](https://alike.network/) currently presents a research-preview sign-in. The supplied [September 2026 early-access guide](https://drive.google.com/file/d/1veVcz5sjNRzdE7xLnIiXshGs-Rnf8Yqv/view) describes Codex and Claude Code support through MCP and hooks. It captures decisions and outcomes, brings relevant context into later sessions and file edits, and tracks superseded decisions. These are vendor descriptions; we have not tested them in Handy.

The guide says access is invitation-based and setup uses one command, but does not supply the command or MCP configuration. Obtain the current installer and client-specific instructions from the sponsor before installing.

## A concrete pilot for Alvin's Dial work

| Moment | Context Alike should carry | Handy example |
| --- | --- | --- |
| Start a task | Latest decisions and previous outcome | Read current shared contracts before implementing `lib/dial.ts`. |
| Edit call handling | File-specific constraints | Quote calls collect estimates; booking requires the approval record. |
| Resume after a break | Completed work, unresolved issue, next check | Call finished but transcript is pending; resume transcript retrieval rather than placing another call. |
| Review a PR | Why the approach was chosen | Explain why an uncertain call response is reconciled before any retry. |
| Change a decision | Supersede the old guidance | Replace an outdated SDK assumption only after verifying the installed SDK and testing the behavior. |

Use one work item such as “Dial quote-call adapter.” Ground it in `PRD.md`, `CLAUDE.md`, `lib/types.ts`, the current implementation spec, and `eng-design/dial-sms-and-calls.md`. Keep accepted API contracts and tests in GitHub. Use Alike to preserve rationale and handoffs around those artifacts.

Suggested first session outcome:

> Implemented X in lib/dial.ts. Verified Y with mock calls. Z remains untested. The next session should run the transcript-readiness check. Never repeat an uncertain call merely to retrieve its transcript.

This is suggested content to validate against the actual work, not a claim that implementation is complete.

## Setup boundary

The guide says linking sends full session transcripts, including tool calls and results, to the user's Alike store, and can import previous history. It describes separate sharing grants, redaction for teammates, and human approval of extracted standing rules. Verify the available controls during setup.

Before connecting, choose the Handy repository and intended history scope, confirm what can be excluded, and explicitly approve transcript sharing. Keep credentials, private phone numbers, home addresses, and real customer conversations out of captured sessions. Gitignored files alone do not prevent their contents entering tool output. No Alike installation, account connection, history upload, or teammate sharing was performed during this exploration.

## Hackathon demonstration

1. Complete a small Dial task and record one real decision and its reason.
2. Start a fresh coding session on the same task.
3. Show the relevant decision and next step arriving without manually pasting the old conversation.
4. Show a later correction superseding the earlier decision, if supported by the installed preview.

Measure onboarding time for the fresh session, repeated explanations, and repeated decisions with and without Alike. Report observed results; do not invent a time-savings percentage.

This makes Alike useful to the team building Handy. There is no verified basis here for using it as a contractor directory, customer-message service, repair database, or runtime workflow engine.
