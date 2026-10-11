# Handy — presentation script

Imagine I'm a new homeowner moving into a house. Before I've finished unpacking, I discover a leaky faucet, a toilet that won't flush, and water under the kitchen sink. Now my evening is disappearing into searches, calls, and trying to figure out who I can trust.

In a 2021 survey, 56 percent of homeowners reported spending one to five hours researching their home-improvement project before even requesting a quote. [Modernize, 2021](https://investor.quinstreet.com/node/16861/pdf)

Or imagine I'm a property manager. The same problems arrive from tenants across multiple properties. I may have to drive out to inspect a leak, find a handyman, compare prices, and coordinate the tenant and the visit. Then another report comes in, and I start again.

In comes Handy.

Here's the leak. I upload a photo and describe what's happening. Claude gives a preliminary assessment and creates a repair brief. If it's a simple fix, Handy offers DIY guidance and part options, with compatibility checks before buying. Here, I'm choosing professional help.

It gives me an explanation to share.

Handy uses Keewano's event history to rank providers by response rate, punctuality, and quote accuracy. It also spots repeat problems at a property, so the agent can ask about replacement as well as repair. The queries are real; our demo history is seeded.

I tap to request quotes. Dial's AI agent explains the issue and asks about price, fees, and availability. Claude turns the conversation into a structured quote with supporting evidence. I review the terms alongside the transcript.

Then I choose a quote and provide times that work for me. Only after I approve does Handy call back to schedule. The provider confirms a matching window, and the appointment stays attached to the right property and unit.

We've verified real quote and booking calls with our controlled test provider. Dial also delivered a repair photo; automatic visual review by the voice agent is still next. These were fictional test appointments. [Live acceptance](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits)

That's the time-saving opportunity: the research, repeated explanations, and scheduling back-and-forth become one flow. The goal is a few minutes to report, review, and approve, while Handy handles the calls. We haven't measured customer savings yet, but those are the hours of coordination we're targeting.

We used Alike to share decisions across our coding sessions. For future payments, Sparta Worlds tested a separate deposit-refund prototype under an injected error, improving passes from three of six to six of six. It isn't connected to booking yet. [Sparta evidence](../sparta/evidence/summary.json)

We propose starting with property managers, where repairs repeat across units, with per-unit subscriptions and booking fees. Then we expand to homeowners.

For me, it's getting back to unpacking. For a manager, it's getting back to running the properties.

Handy. A photo, an approval, and your time back.
