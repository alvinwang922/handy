# Submission kit: verified claims + form text

**Status:** Draft, checked against `main` at `28a9bbe` on October 11, 2026. Recheck the integration status before recording if teammates ship new changes.

The story-led [presentation script](presentation-script.md) opens with both the new homeowner and the property manager, then follows their shared repair workflow. Its recording target is **4:45**. Confirm the organizer's judging weights, video limit, and submission deadline in the submission portal; those rules have not been independently verified here.

## Numbers we can defend

| Claim | Evidence and how to present it |
|---|---|
| Homeowners spend 1–5 hours researching before requesting a quote | **56% of respondents** in Modernize's **2021 home-improvement survey** reported this. This is historical survey context, not a measured average for every small repair. [Primary source](https://investor.quinstreet.com/node/16861/pdf) |
| Homeowners seek multiple bids | ArcSite's **2022 report**, based on a survey of over 1,000 homeowners in late 2021, says **95% seek more than one bid**, and a majority often seek three or more. Bids are not necessarily phone calls. [Primary source](https://www.arcsite.com/blog/2022-homeowner-survey-report) |
| About 108 minutes of manual coordination per repair | **Our illustrative estimate:** 30 min research + 3 providers × (3 min finding a number + 8 min calling + 10 min phone tag) + 15 min scheduling = **108 min**. These assumed components are not a survey result. [Model](../README.md#the-problem) |
| Ten repairs require 18 hours of coordination | **Illustrative extrapolation:** 10 × 108 min / 60 = **18 hours**, before any travel. This is not a measured property-manager workload or a claim of 18 hours saved. |
| Mission Pipe Pros answers 59% of calls and bills about 18% above its quotes | Correct for the **fictional provider's seeded history**: 10 answered / 17 calls ≈ 59%; mean bill overrun ≈ 18.4%, rounded to 18%. Do not present these as a real company's performance. [Keewano Q&A](keewano-qa.md#q1-which-plumbers-can-we-rely-on-and-who-should-we-skip), [seed](../scripts/seed-keewano.ts) |
| Median manual report-to-booking time is about 37 hours | **Seeded baseline**, 120 requests: **2,225 min = 37 h 5 min**. This is elapsed time, not hands-on effort or measured Handy savings. Mean seeded hands-on effort is about 107 min; the separate illustrative model above is 108 min. [Keewano Q&A](keewano-qa.md#q2-how-long-does-booking-take-manually-vs-with-handy) |
| A live quote and subsequent booking succeeded | One controlled, fictional provider returned **$220 with no visit fee**. After approval, a separate live call confirmed **October 13, 2026, 9–11 AM Pacific** from two submitted windows. Use current future windows in a new run. These are integration-test terms, not a market quote or real service appointment. [Acceptance record](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits) |
| Sparta improved 3/6 → 6/6 | The committed matrix contains six runs per version under a single injected HTTP 500: the naive agent passed 3/6 and the fixed agent passed 6/6. This is a **separate deposit-settlement prototype**, not the connected app or a general reliability percentage. The fixed run exercises GET retry; refund POST idempotency replay was not exercised. [Evidence](../sparta/evidence/summary.json), [limitations](../sparta/README.md#honest-limitations) |

The research surveys motivate the problem. They do not validate our 108-minute model or prove Handy's savings. Remove the unsupported claim that the pictured leak takes exactly 20 minutes to fix.

## What the demo can honestly show today

- **Live diagnosis and part search:** Claude returns a preliminary assessment and purchase options. Say “preliminary cost estimate,” not “fair market price.” Check model, dimensions, and connection type before claiming a part fits. Automatic ordering, delivery tracking, and part-specific installation after arrival are product requirements, not validated live capabilities.
- **Controlled live backend:** Quote calling, production transcript extraction, exact-quote approval, and a separate scheduling call passed through the real API endpoints. The providers are fictional personas on controlled numbers. [Handoff](../eng-design/dial-endpoint-handoff.md)
- **Current web UI:** New API-backed requests now use the outreach, quote, exact-quote approval, booking, and transcript endpoints. Built-in sample requests retain simulated behavior, and mock flags still determine whether backend calls are real. A full live browser journey was verified on 2026-10-11: real diagnosis, Keewano ranking, one real Dial quote call, Claude extraction, explicit approval, a real Dial booking call, and a scheduled appointment. [UI](../public/index.html), [wiring commit](https://github.com/alvinwang922/handy/commit/28a9bbe)
- **Photo messaging:** A real image MMS was delivered to a controlled Dial number and the exact image receipt was verified. `photoReviewState` remains `unknown`; delivery does not prove the voice agent viewed or used it. Arbitrary contractor phones were not validated.
- **Multiple quotes:** The simulated journey covers three quotes. Parallel live outreach remains untested; the controlled live demo uses `QUOTE_FANOUT=1` and `MAX_CONCURRENT_CALLS=1`.
- **Keewano:** Real ranking/history queries over labeled seeded data. Do not treat the seeded manual baseline as customer outcomes. A recorded query should display the current result, not assume it is unchanged.
- **Time savings:** The frontend does not yet measure hands-on time. Use an external stopwatch and label any recorded figure as “this demo's measured user interaction time”; distinguish user interaction from agent processing and waiting. Do not fill in a result before timing the run.
- **Calendar:** The `.ics` export currently guesses dates, uses floating local time, and assumes a two-hour duration. An October 13 dated window reproduced as October 12 when parsed on October 11. Show the stored confirmed window; do not claim an accurate calendar invite until this is fixed. [Code](../lib/ics.ts)
- **Sparta and Alike:** Sparta tests a separate intended payment extension. Alike was used for shared decisions and development coordination; do not claim that every agent saw every decision.
- **Commercial plan:** Property managers with 50–500 units are the proposed initial segment. Per-unit pricing, booking fees, and provider receptionist onboarding are proposed, not existing revenue or a launched marketplace.

## HackerSquad form text

**Project name:** Handy

**Description (problem, user, how it works, time saved):**

> A new homeowner finds a leaky faucet and a toilet that will not flush. A property manager receives the same kinds of reports across many units. Research illustrates the coordination burden: Modernize's 2021 survey found 56% of respondents spent one to five hours researching a home-improvement project before requesting a quote. ArcSite's 2022 report found 95% sought multiple bids. Our separate illustrative model estimates 108 minutes of manual coordination per repair; actual Handy time savings have not yet been measured. [Modernize](https://investor.quinstreet.com/node/16861/pdf), [ArcSite](https://www.arcsite.com/blog/2022-homeowner-survey-report).
>
> Handy starts with a photo and description. Claude gives a preliminary assessment, urgency, and repair brief. For a simple fix, it offers DIY guidance and searches for purchase options, with compatibility checks still required. For professional work, Keewano ranks providers using event history, Dial calls for estimates, and Claude converts the provider's words into evidence-backed quote records. After explicit approval of a specific quote and acceptable time windows, a separate Dial call confirms scheduling.
>
> The backend has passed a real controlled quote call, image-MMS delivery, production quote extraction, and a subsequent approved booking call. Provider personas and Keewano history are fictional/seeded and labeled. New API-backed web requests now connect to outreach and booking; built-in samples remain simulated. A full live browser journey (diagnosis, Keewano ranking, one Dial quote call, extraction, approval, Dial booking call, scheduled) was verified on 2026-10-11. Multiple quotes have been tested in simulation, while parallel live calls are untested. MMS receipt does not yet prove the voice agent reviewed the image. Accurate calendar export and automatic provider discovery remain next steps.
>
> We propose starting with property managers of 50–500 units, followed by homeowners. Alike supported our four engineers' agent coordination. A separate Sparta Worlds deposit-settlement prototype improved from 3/6 to 6/6 passes in the recorded injected-failure test matrix; it is not connected to the app.

**Technologies:** Next.js 16, TypeScript, Claude (Opus 5.5 vision + Sonnet 5.5, structured outputs, web search), Dial (AI voice calls + controlled image MMS), Keewano (event DB: SQL + MCP), Sparta Worlds (separate deposit prototype tested against a local Stripe simulation), Alike (development coordination), zod, vitest.

**Partner tools used:** Dial · Keewano (project: **Handy**) · Sparta · Alike.

**Repository:** https://github.com/alvinwang922/handy

**Before submitting:** Replace any timing placeholders with actual observations, verify the organizer's rules and deadline, and click **Submit**. The team's [guide](../CLAUDE.md) lists **5:00 PM PDT**; confirm that against the organizer's current instructions. Saving a draft does not submit it.
