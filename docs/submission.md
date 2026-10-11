# Submission kit: video script + form text

The judging weights shape the script: **problem & time saved 40%**, technical execution 25%, market 15%, originality 10%, demo 10%.
The rules require: a video of **5 minutes or less** showing the problem, the product working, and the time it saves, plus a clear statement of what works today, what is mocked, and what's next.

---

## Video script (target 4:40)

**Before recording:**
- Run on the demo laptop with the real keys.
- Have one teammate's phone on speaker as "Golden Gate Plumbing".
- Make sure the AI-receptionist number is set up (`npm run setup:receptionist`).
- Open Claude Code with the Keewano MCP connected.
- If a live call misbehaves, keep the take and cut to the backup recording of the same step (label it).

### 0:00–0:30 · The problem (40% criterion: say the numbers)
**Screen:** a photo of a leaking sink trap. A stopwatch running.

**Narration:**
> "This leak takes a plumber 20 minutes to fix. Getting a plumber takes most people hours. Homeowners research for one to five hours before they even ask for a quote, then call three or more providers, play phone tag and schedule. Our estimate is about an hour and 48 minutes of someone's time per repair. Property managers do this all week. Handy gives that time back."

### 0:30–1:15 · Snap a photo → real diagnosis
**Screen:** Report issue → add the photo → Claude's assessment (likely issue, trade, cost range, visible evidence, the brief we'll read to providers).

**Narration:**
> "Snap a photo and describe it. Claude Opus 5.5 looks at the image, names the likely issue, the trade, a fair price range, and writes the brief our phone agent will read. If it's a simple fix, it offers a DIY plan with the right part. And if it's an emergency, like gas, sparks or flooding, Handy stops and tells you what to do right now. It does not start calling handymen."

### 1:15–2:00 · Keewano decides who to call (technical + originality)
**Screen:** Claude Code with the Keewano MCP. Ask: *"Which plumbers can we rely on, and who should we skip?"* (`docs/keewano-qa.md` Q1). Then show the outreach API response's `rankedProviders` reasons (from `npm run smoke:dial` or the end-to-end run).

**Narration:**
> "Who should we call? Star ratings would pick Mission Pipe Pros at 4.4 stars. Keewano, our event database, knows from (seeded, labeled) history that they answer only 59% of calls and bill 18% over their quotes, so Handy skips them. It also knows this unit has had two plumbing issues in six months, so the call script asks for a replacement price too. This query runs live; it is what decides who gets called."

### 2:00–2:50 · Dial makes the call; Claude turns it into a quote (technical 25%)
**Screen:** `npm run smoke:dial` in a terminal. The AI-receptionist number (or a teammate's phone on speaker) rings. Play ~10 s: the AI disclosure, then a price. Show the resulting quote JSON: `$180–$250`, `feeTreatment: waived_if_hired`, `availability`, and the `evidence` excerpts.

**Narration:**
> "Here's a real Dial call. The agent says up front that it's an AI, reads the brief, asks for price, fees and openings, and never books or gives out the address. Claude Sonnet turns the transcript into a structured quote backed by the provider's own words: an $89 fee waived if hired is not an extra $89, and an unknown price stays unknown, never zero."

### 2:50–3:15 · Approve → it books (show the real booking run)
**Screen:** `npm run smoke:booking`: the approval tied to one quote, the booking call, `status: scheduled`, then the `.ics` file.

**Narration:**
> "Nothing is booked until you approve one specific quote. Then Handy calls back, confirms a window and the access details, and it's on your calendar. Our app screens for this step are still the prototype; this is the live backend doing it."

### 3:15–3:35 · Time saved (honest numbers)
**Narration:**
> "Your hands-on part is a photo, a review and one approval: a few minutes. The usual process is about an hour and 48 minutes of hands-on time by our estimate, built from homeowner surveys. Keewano records minutes-to-book for every request, so this becomes a measured number as real requests flow through."

### 3:35–4:05 · Trust and reliability (technical 25%)
**Screen:** split view of `cd sparta && npm run before` (FAIL) and `npm run after` (PASS).

**Narration:**
> "Money is next. We built the deposit-refund agent that runs after booking and tested it in Sparta Worlds, a local copy of Stripe, with an injected server error. The naive version told the resident 'your deposit was refunded' when no refund existed, and passed 3 of 6 runs. The fixed version retries with a stable idempotency key, verifies the refund, and passes 6 of 6."

### 4:05–4:25 · Real vs simulated, and how we built it
**Screen:** the README's "What's real vs simulated" table.

**Narration:**
> "To be clear about today: the diagnosis, part search, Dial calls and Keewano queries are real. The providers are our teammates and our own AI receptionist; we never call real businesses with fake jobs. Keewano's history is seeded and labeled. Four engineers built this in a day with Claude Code, coordinated through Alike so every agent saw our shared decisions."

### 4:25–4:45 · Market and what's next (15% criterion)
**Narration:**
> "We start with property managers of 50 to 500 units, who coordinate repairs every day. They pay per unit, and we take a small fee per booked job. Pros get a free AI receptionist that answers our calls and their own missed calls, which fills the supply side of a two-sided marketplace. Next: live provider discovery, payments, and turning every repair into data that makes the next one faster. Handy: snap a photo, it's handled."

---

## HackerSquad form text

**Project name:** Handy

**Description (problem, user, how it works, time saved):**
> Handy turns a photo of a home-repair problem into a booked appointment. Today, getting a repair scheduled costs homeowners and property managers hours: researching pros, calling three or more of them, repeating the same description, phone tag, and scheduling. We estimate about 108 minutes of hands-on time per repair.
>
> With Handy you snap a photo. Claude Opus 5.5 diagnoses it (trade, urgency, cost range, a DIY plan when it's safe) and stops for emergencies. Keewano ranks providers from event history: who actually answers, shows up on time, and bills what they quoted. It also flags a unit's recurring issues. Dial AI voice agents call the top providers in parallel. They disclose that they are AI, never commit, and turn each conversation into a structured, evidence-backed quote. You approve one specific quote, and Handy calls back to book it and adds it to your calendar. Your hands-on time drops to a few minutes.
>
> Built for property managers first (50–500 units) and homeowners next. Sparta Worlds verifies our post-booking deposit agent: 3/6 → 6/6 under injected failures. Alike coordinated our four engineers' coding agents.
>
> What's simulated: the providers are teammates and our own AI receptionist, and Keewano history is seeded and labeled. The app's outreach, quote and booking screens are still the prototype; the live backend for those steps (Dial calls, extraction, approval, booking) is verified in tests and a live acceptance run. Details are in the README's "What's real vs simulated" table.

**Technologies:** Next.js 16, TypeScript, Claude (Opus 5.5 vision + Sonnet 5.5, structured outputs, web search), Dial (AI voice calls), Keewano (event DB: SQL + MCP), Sparta Worlds (agent testing on a Stripe copy), Alike (agent coordination), zod, vitest

**Partner tools used:** Dial · Keewano (project: **Handy**) · Sparta · Alike

**Repository:** https://github.com/alvinwang922/handy

**Reminder:** fill in the form early, record the video, then click **Submit**. Saving a draft does not submit. Deadline: **5:00 PM PDT**.
