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

### 1:15–2:15 · Keewano decides who to call; Dial calls them (technical + originality)
**Screen:** the provider list with Keewano reasons. **Mission Pipe Pros skipped** ("answers 59% of calls, final bill +18% vs quote"). The unit-history banner ("2 earlier plumbing issues here → also asking for a replacement quote"). Then 2–3 call cards go Ringing → In progress, and a teammate's phone rings on speaker.

**Narration:**
> "Who should we call? Star ratings would call Mission Pipe Pros at 4.4 stars. Keewano, our event database, knows they answer only 59% of calls and bill 18% over their quotes, so Handy skips them. It also knows this unit has had two plumbing issues in six months, so every call asks for a replacement price too.
> Now Dial's AI voice agents call the top providers in parallel. Each says up front it's an AI, reads the brief, and asks for price, fees and two openings. It never books and never gives out the address."

*(Let ~10 s of the speakerphone call play: the AI disclosure and a price.)*

### 2:15–3:00 · Structured quotes → you approve → it books
**Screen:** the comparison table. "$180–$250 flat · $89 visit fee **waived if hired**" and "No answer" on one row. Approve → choose time windows → booking call → **Scheduled** → download the calendar invite.

**Narration:**
> "Every call becomes a structured quote, backed by the provider's own words. 'Waived if hired' is not an extra $89, and an unknown price stays unknown, never zero. Nothing is booked until you approve a specific quote. Then Handy calls back, confirms a window and the access details, and it's on your calendar."

### 3:00–3:35 · Time saved (say both numbers)
**Screen:** the time meter, "Your time: X min · Typical: ~1 h 48 m (estimate)". Then Claude Code asking Keewano live: *"How long does booking take manually vs with Handy?"*

**Narration:**
> "My active time was [X] minutes: a photo, a review, one approval. The typical process is about an hour and 48 minutes of hands-on time. Our seeded baseline of manual requests took a median of 37 hours from report to booking. And we can ask Keewano anything, live."

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
> With Handy you snap a photo. Claude Opus 5.5 diagnoses it (trade, urgency, cost range, a DIY plan when it's safe) and stops for emergencies. Keewano ranks providers from event history: who actually answers, shows up on time, and bills what they quoted. It also flags a unit's recurring issues. Dial AI voice agents call the top providers in parallel. They disclose that they are AI, never commit, and turn each conversation into a structured, evidence-backed quote. You approve one specific quote, and Handy calls back to book it and adds it to your calendar. Your hands-on time drops to a few minutes, measured in-app.
>
> Built for property managers first (50–500 units) and homeowners next. Sparta Worlds verifies our post-booking deposit agent: 3/6 → 6/6 under injected failures. Alike coordinated our four engineers' coding agents.
>
> What's simulated: the providers are teammates and our own AI receptionist, and Keewano history is seeded and labeled. Quote extraction from live calls is in progress. Details are in the README's "What's real vs simulated" table.

**Technologies:** Next.js 16, TypeScript, Claude (Opus 5.5 vision + Sonnet 5.5, structured outputs, web search), Dial (AI voice calls), Keewano (event DB: SQL + MCP), Sparta Worlds (agent testing on a Stripe copy), Alike (agent coordination), zod, vitest

**Partner tools used:** Dial · Keewano (project: **Handy**) · Sparta · Alike

**Repository:** https://github.com/alvinwang922/handy

**Reminder:** fill in the form early, record the video, then click **Submit**. Saving a draft does not submit. Deadline: **5:00 PM PDT**.
