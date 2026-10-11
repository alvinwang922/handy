# Handy — presentation script

Imagine I'm a new homeowner moving into a house. There's a leaky faucet, a toilet that isn't working, and water under the kitchen sink. Before I can settle in, I need to figure out what's wrong, research prices, find handymen, compare quotes, and coordinate a visit.

Research shows that 56 percent of surveyed homeowners spent one to five hours researching their home-improvement project before even requesting a quote. That's time spent before the repair even begins. [Modernize, 2021](https://investor.quinstreet.com/node/16861/pdf)

Or imagine I'm a property manager. Those same problems arrive from tenants across multiple properties. I may need to commute to check an issue, contact handymen, research prices, and coordinate the provider, the tenant, and access to the unit. Every repair becomes another round of calls and follow-ups.

In comes Handy.

Handy takes on the coordination so I can focus on the decision. I upload a photo and a short description. Claude gives a preliminary assessment, safety guidance, and a clear repair brief. For a simple fix, Handy offers DIY guidance and searches for part options, with compatibility checks before buying. When professional help is needed, it starts the quoting workflow.

Keewano stores repair and provider events that we use to rank providers by response rate, punctuality, and quote accuracy. It also identifies recurring issues so we can ask whether replacement makes more sense than another repair; our demo history is seeded.

Dial's AI voice agent explains the problem and asks providers about scope, price, fees, and availability. Claude turns their responses into structured quotes backed by the provider's own words. Dial's messaging API also delivered a repair photo in our controlled test; automatic visual review by the voice agent is a next step.

I review the quote, approve its terms, and submit times that work for me. Only then does Handy make a separate scheduling call and confirm a matching window. For a manager, the approval and appointment stay attached to the right property and unit.

We validated real quote and booking calls with controlled test providers: a $220 quote with no visit fee, followed by confirmation of one of the submitted windows. These were fictional test appointments. [Live acceptance](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits)

Here's the time-saving opportunity. Our model estimates 108 minutes of manual coordination per repair. Our goal is to bring the user's hands-on involvement to about five minutes—that's roughly 100 minutes back per repair, or about 17 hours across ten repairs. Those are modeled targets; measuring actual customer savings is next. [Estimate and assumptions](submission.md#numbers-we-can-defend)

We used Alike to share engineering decisions and preserve context across our coding agents' sessions. For future payments, Sparta Worlds tested a separate deposit-refund prototype against simulated Stripe with an injected server error: passes improved from three of six to six of six. That prototype isn't connected to the app yet. [Sparta evidence](../sparta/evidence/summary.json)

We propose starting with property managers, where this work repeats across units, and bringing the same experience to homeowners. Next are verified provider discovery, accurate calendar export, and measured savings.

Handy. Less time coordinating repairs. More time living in your home—or managing your properties.
