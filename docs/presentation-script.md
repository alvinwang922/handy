# Handy — presentation script, first draft

**Target:** About 4:45 including a short call excerpt. Rehearse and adjust to the organizer's confirmed limit. Timings are pacing goals, not measured recording length.

**Story:** Open with both users: a new homeowner facing unfamiliar repairs and a property manager coordinating those same problems across units. Follow one leaking-sink request through Handy, then show how the workflow scales to the manager's portfolio.

## 0:00–1:00 · Two users, the same coordination problem

**Show:** A new homeowner's moving boxes, leaky faucet, and broken toilet. Then a property manager's tenant reports across several units. Pick one sink request for the shared demo flow.

**Say:**

> Imagine I'm a new homeowner moving into a house. There's a leaky faucet, a toilet that isn't working, and water under the kitchen sink.
>
> Before I can get anything fixed, I need to figure out what's wrong, research prices, find handymen, and contact them for quotes.
>
> Research shows that 56 percent of surveyed homeowners spent one to five hours researching their home-improvement project before even requesting a quote. [Modernize, 2021](https://investor.quinstreet.com/node/16861/pdf)
>
> Or imagine I'm a property manager. Tenants report those same problems across multiple properties. I may need to commute to a property to check the issue, research prices, contact handymen, and coordinate the tenant, the provider, and access to the unit.
>
> Handy helps both users: start with a photo, review the options, and approve the next step.

**On screen:** Keep the source citation visible beside the statistic. Citations in the script are not spoken aloud. The survey measures homeowner project research; no property-manager commuting-hours benchmark is claimed.

## 1:00–1:30 · One photo becomes a repair brief

**Show:** Upload the sink photo and add a short description. Display the actual API diagnosis. Show the professional and DIY choices.

**Say:**

> I add a photo of the leak and a short description.
>
> Claude returns a preliminary assessment, safety guidance, and a repair brief.
>
> For a simple fix, Handy offers DIY guidance and part options, with compatibility checks before buying. For this repair, I'm choosing professional help.

## 1:30–2:05 · Choose whom to contact

**Show:** Keewano query output with a visible **Seeded demo history** label. Show provider ranking and the unit's repeat issues.

**Say:**

> Keewano stores repair and provider events. We query that history to rank providers by response rate, punctuality, and quote accuracy, and flag recurring issues that may need replacement.
>
> In our seeded demo data, fictional Mission Pipe Pros answers 59 percent of calls and bills about 18 percent above its quotes, so Handy skips it despite a 4.4-star rating. [Seeded results](keewano-qa.md)
>
> The intended flow collects multiple quotes. Today's controlled live demonstration contacts one provider.

## 2:05–2:50 · Make the quote call

**Show:** On a newly created API-backed request, use **Get quotes** and show the returned transcript/quote. Verify live flags first; built-in sample requests and mock-mode calls are not live-call evidence. For the verified backend acceptance, play an 8–10 second recorded excerpt labeled **Recorded controlled live test · October 11, 2026**.

**Say:**

> Dial makes the AI quote calls and a separate scheduling call after approval. The agent discloses it's an AI and asks about price, fees, and availability without committing during quoting.
>
> Claude extracts a quote backed by the provider's words. Our controlled live test returned 220 dollars with no visit fee. [Acceptance record](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits)
>
> Dial's messaging API delivered a repair photo to our test number; automatic visual review by the voice agent remains next.

**Presenter cue:** If a new run returns different terms, read those terms. Do not narrate $220 over a different quote. A sample comparison table must remain labeled **Sample quotes**; it is not evidence of multiple live responses.

## 2:50–3:30 · I approve; Handy schedules

**Show:** The exact quote approval request, two submitted windows, the scheduling call, and the persisted booking confirmation. Use future dates for a new run. Show the confirmed text rather than the current calendar export.

**Say:**

> I choose the quote, approve its terms, and submit two windows when I can be home. Handy makes a separate call to that provider to find a matching appointment.
>
> It only marks the request scheduled when the provider confirms an allowed window and the approved terms still hold. A changed price needs another approval.
>
> Our controlled live test confirmed one of two submitted windows. That is a fictional appointment with our AI receptionist. For a property manager, the same approval stays attached to the correct property and unit. [Acceptance record](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits)

## 3:30–4:00 · What time are we trying to save?

**Show:** The 108-minute assumption breakdown from [submission.md](submission.md#numbers-we-can-defend). If a measured demo time is available, show it separately with the measurement method.

**Say:**

> The work we want to remove is researching numbers, repeating the issue, chasing responses, and coordinating schedules. Our own model estimates 108 minutes per repair. That is separate from the survey and is not measured savings.
>
> For ten repairs, that model means 18 hours of coordination before travel. Handy aims to reduce the user's involvement to reporting, reviewing, and approving. We're measuring that next.

## 4:00–4:45 · What works, and where we go next

**Show:** The homeowner's confirmed repair, then switch to the property-manager view and its property/unit queue. Finish with the four sponsor credits and current validation status.

**Say:**

> Diagnosis and part search are live. The UI now connects API-backed requests to outreach and booking; the backend has passed controlled live calls. Built-in sample requests remain simulated.
>
> We used Alike to share engineering decisions and carry context between our coding agents' sessions.
>
> Sparta Worlds tested a separate deposit-refund prototype against simulated Stripe with an injected server error. It improved from three of six to six of six passes and isn't connected to the app yet.
>
> We propose starting with property managers, then homeowners. Next are verified provider discovery, accurate calendar export, and measuring actual savings.
>
> Handy: report the problem, review the options, approve the repair.

## Sponsor sentences and repo evidence

These lines are incorporated into the scenes above. Use this as a reference for the sponsor slide; do not read it again as an extra segment.

| Sponsor used | One or two sentences for the presentation | Evidence / placement |
|---|---|---|
| **Dial** | “We use Dial to make AI voice calls for quotes and, after user approval, a separate call to schedule the appointment. Its messaging API also delivered a repair photo to our controlled test number.” | [Voice adapter](../lib/dial.ts), [message adapter](../lib/communications/dial-messages.ts), [controlled live acceptance](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits). Quote-call scene and scheduling scene. |
| **Keewano** | “Keewano stores repair and provider events that we query to rank providers by response rate, punctuality, and quote accuracy. It also flags recurring issues so our agent can ask about replacement as well as repair; the demo history is seeded.” | [Event writes, ranking and unit insight](../lib/keewano.ts), [provider selection](../lib/orchestrator.ts), [live query examples](keewano-qa.md). Provider-selection scene. |
| **Alike** | “We used Alike to record shared engineering decisions and preserve context across coding-agent sessions. That gave the team a common reference for the API contracts we were building.” | [Team workflow](../CLAUDE.md#alike-team-coordination-for-our-coding-agents), [repository partner summary](../README.md#partner-tools). Development credit in the closing scene. This is development tooling; no runtime Alike integration is claimed. |
| **Sparta Worlds** | “We used Sparta Worlds to test a separate deposit-refund prototype against simulated Stripe with an injected server error. Recorded passes improved from three of six to six of six; this prototype isn't connected to the app yet.” | [Prototype and limitations](../sparta/README.md), [agent](../sparta/projects/handy-deposits/settlement-agent.mjs), [recorded evidence](../sparta/evidence/summary.json). Reliability credit in the closing scene. |

## Recording notes

- A recorded live test is acceptable evidence when visibly labeled; call it a recording, not a call happening now. Keep the test provider fictional and controlled.
- The UI was wired to the backend in `28a9bbe`: new API-backed requests call outreach/book and poll results; built-in samples retain simulated behavior. The commit records a browser check in mock mode. A fresh live UI journey has not been independently verified in this presentation review; use the recorded live backend evidence if needed.
- For a demo timing measurement, sum the user's actual interaction intervals separately from call/model waiting. Report the method and sample size; do not treat a five-minute video as five minutes of user work.
- Automatic ordering, arrival tracking, and part-specific installation are part of the product direction. Do not demonstrate a simulated purchase as a real order.
- If asked about pricing, say: “Our proposed model is a per-unit subscription for property managers, with a fee per booked job. Pricing and willingness to pay still need validation.”
- Sources, arithmetic, seeded numbers, and current limits are in [submission.md](submission.md). Confirm event rules and rehearse aloud before recording.
