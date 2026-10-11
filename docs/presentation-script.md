# Handy — presentation script, first draft

**Target:** About 4:45 including a short call excerpt. Rehearse and adjust to the organizer's confirmed limit. Timings are pacing goals, not measured recording length.

**Story:** A new homeowner has several small problems, but coordinating the repairs becomes another job. Follow one leaking-sink request through Handy. The property-manager opening below can replace the first scene.

## 0:00–0:45 · Moving in is enough work already

**Show:** A moving box, a leaking faucet or sink photo, and a toilet issue. Pick one sink request for the rest of the demo.

**Say:**

> Imagine I'm a new homeowner moving into a house. There's a leaky faucet, a toilet that isn't working, and water under the kitchen sink.
>
> Before I can get anything fixed, I need to figure out what's wrong, research prices, find handymen, and contact them for quotes.
>
> Research shows that 56 percent of surveyed homeowners spent one to five hours researching their home-improvement project before even requesting a quote. [Modernize, 2021](https://investor.quinstreet.com/node/16861/pdf)
>
> Then I still have to compare the quotes and find a time for someone to come over.
>
> With Handy, I start with a photo, review the options, and approve the next step.

**On screen:** Keep the source citation visible beside the statistic. Citations in the script are not spoken aloud.

## 0:45–1:20 · One photo becomes a repair brief

**Show:** Upload the sink photo and add a short description. Display the actual API diagnosis. Show the professional and DIY choices.

**Say:**

> Here's the leak under my sink. I add a photo and a sentence about what's happening.
>
> Claude gives a preliminary assessment: the likely issue, the trade we need, any safety concern, and a brief to share with providers. It isn't a guaranteed diagnosis.
>
> Sometimes a simple fix may only need a part. Handy can search for purchase options and offer DIY guidance, with compatibility checks before buying. For this repair, I'm choosing professional help.

## 1:20–2:00 · Choose whom to contact

**Show:** Keewano query output with a visible **Seeded demo history** label. Show provider ranking and the unit's repeat issues.

**Say:**

> A star rating doesn't tell me who will answer or whether the final bill will match the quote. Handy uses Keewano's event history to rank providers and identify recurring issues at the property.
>
> In our seeded demo data, Mission Pipe Pros answers 59 percent of calls and bills about 18 percent above its quotes. Handy skips it despite a 4.4-star rating. These are fictional providers, not claims about real businesses.
>
> The intended flow collects multiple quotes. Today's controlled live demonstration contacts one provider.

## 2:00–2:45 · Make the quote call

**Show:** Switch from sample UI to the live backend harness and its saved transcript/quote. Play roughly 8–10 seconds of the AI disclosure and provider response. If using recorded acceptance, label it **Recorded controlled live test · October 11, 2026**.

**Say:**

> Dial's voice agent introduces itself as an AI, explains the repair, and asks about scope, price, fees, and availability. It requests an estimate without booking or sharing the exact address.
>
> Claude then extracts a quote with evidence from the provider's words. In our completed live test, the controlled provider quoted 220 dollars with no visit fee.
>
> We also verified image-MMS delivery. The voice agent's ability to view that image is a separate step still to implement.

**Presenter cue:** If a new run returns different terms, read those terms. Do not narrate $220 over a different quote. A sample comparison table must remain labeled **Sample quotes**; it is not evidence of multiple live responses.

## 2:45–3:30 · I approve; Handy schedules

**Show:** The exact quote approval request, two submitted windows, the scheduling call, and the persisted booking confirmation. Use future dates for a new run. Show the confirmed text rather than the current calendar export.

**Say:**

> I choose the quote, approve its terms, and submit two windows when I can be home. Handy makes a separate call to that provider to find a matching appointment.
>
> It only marks the request scheduled when the provider confirms an allowed window and the approved terms still hold. A changed price needs another approval.
>
> Our live test confirmed the first of two submitted windows through the actual booking endpoint. It was a fictional test appointment with our own AI receptionist, not a visit from a real contractor.

## 3:30–4:00 · What time are we trying to save?

**Show:** The 108-minute assumption breakdown from [submission.md](submission.md#numbers-we-can-defend). If a measured demo time is available, show it separately with the measurement method.

**Say:**

> The work we want to remove is researching numbers, repeating the issue, chasing responses, and coordinating schedules. Our own model estimates 108 minutes per repair. That is separate from the survey and is not measured savings.
>
> For ten repairs, that model means 18 hours of coordination before travel. Handy aims to reduce the user's involvement to reporting, reviewing, and approving. We're measuring that next.

## 4:00–4:45 · What works, and where we go next

**Show:** A compact status card: live diagnosis/parts and controlled quote/booking backend; sample UI outreach/booking; seeded history. Finish on the confirmed repair record.

**Say:**

> Today, diagnosis and part search are live. We validated real quote and scheduling calls on the backend; connecting the sample UI is still in progress. Keewano's demo history is seeded. We used Alike to coordinate development decisions.
>
> For future payments, our separate Sparta deposit prototype improved from three of six to six of six passes under an injected failure. It isn't connected to booking yet.
>
> We propose starting with property managers, then homeowners. Next are verified provider discovery, the connected UI, accurate calendar export, and measuring actual savings.
>
> Handy: report the problem, review the options, approve the repair.

## Alternative opening · A property manager's morning

**Replace the first scene; do not add this on top. Show:** Three tenant reports attached to different units: a leak, a broken toilet, and a malfunctioning appliance.

**Say:**

> Imagine I'm a property manager. One tenant reports a leak, another says the toilet won't flush, and a third sends an appliance photo.
>
> I may need to travel to the property to check the issue. Then I research prices, contact handymen, explain the problem, and coordinate the visit with the tenant.
>
> Research shows most surveyed homeowners spend one or two hours researching contractors, and 95 percent seek multiple bids. As a manager, I repeat that process across units. [ArcSite, 2022](https://www.arcsite.com/blog/2022-homeowner-survey-report)
>
> With Handy, the tenant starts with a photo. I review the options and approve the next step.

**On screen:** Cite ArcSite beside the statistic and label it as a homeowner survey. It does not measure property-manager travel time.

**Transition:** “Let's follow one leaking-sink report.” Continue with the photo scene. Do not invent a commuting-hours benchmark; use a manager's documented travel logs if we later obtain them.

## Recording notes

- A recorded live test is acceptable evidence when visibly labeled; call it a recording, not a call happening now. Keep the test provider fictional and controlled.
- Show live backend evidence separately from the sample web UI until the teammate's integration is verified. Recheck current `main` before recording and update these cues when it changes.
- For a demo timing measurement, sum the user's actual interaction intervals separately from call/model waiting. Report the method and sample size; do not treat a five-minute video as five minutes of user work.
- Automatic ordering, arrival tracking, and part-specific installation are part of the product direction. Do not demonstrate a simulated purchase as a real order.
- If asked about pricing, say: “Our proposed model is a per-unit subscription for property managers, with a fee per booked job. Pricing and willingness to pay still need validation.”
- Sources, arithmetic, seeded numbers, and current limits are in [submission.md](submission.md). Confirm event rules and rehearse aloud before recording.
