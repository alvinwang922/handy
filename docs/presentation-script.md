# Handy — presentation script

Imagine I'm a new homeowner moving into a house. There's a leaky faucet, a toilet that isn't working, and water under the kitchen sink. Now I have to figure out what's wrong, research prices, find handymen, and arrange a visit.

Research shows that 56 percent of surveyed homeowners spent one to five hours researching their home-improvement project before even requesting a quote. [Modernize, 2021](https://investor.quinstreet.com/node/16861/pdf)

Or imagine I'm a property manager. Those same reports arrive across multiple properties. I may need to commute to inspect an issue, contact handymen, compare prices, and coordinate the provider, tenant, and access. That work repeats with every repair.

In comes Handy.

Let's follow this leaking sink through the app. I upload a photo and a short description. Claude returns a preliminary assessment, safety guidance, and a repair brief. For a simple fix, Handy can suggest DIY guidance and part options. Here, I'm choosing professional help.

Our model budgets 30 minutes for initial research. Our target is about one minute of user input here—potentially 29 minutes back before we've even contacted a provider. [Model and assumptions](submission.md#numbers-we-can-defend)

Keewano ranks providers by response rate, punctuality, and quote accuracy, and flags recurring issues that may warrant replacement. Our demo history is seeded; the queries are real.

I ask for quotes. Dial's AI agent asks about scope, price, fees, and availability. Claude extracts a quote with supporting evidence. Dial also delivered a repair photo in our test; voice-agent visual review remains next.

Our model budgets 63 minutes for finding numbers, calling three providers, and phone tag. Our target is three minutes reviewing quotes while Handy handles the outreach—about an hour of coordination back. Parallel live outreach still needs validation. [Model and assumptions](submission.md#numbers-we-can-defend)

Now I approve a specific quote and submit acceptable time windows. Only then does Handy call back to schedule. The appointment stays attached to the correct property and unit.

That replaces the 15 minutes we've budgeted for scheduling with a target of one minute to approve and provide availability—another potential 14 minutes back. [Model and assumptions](submission.md#numbers-we-can-defend)

We validated real quote and booking calls with our controlled provider: a $220 quote with no visit fee, followed by confirmation of a submitted window. It was a fictional test appointment. [Live acceptance](../eng-design/dial-endpoint-handoff.md#current-evidence-and-limits)

Together, that's a modeled reduction from 108 minutes to five minutes of hands-on work: roughly 100 minutes back per repair, or 17 hours across ten repairs. These are targets; actual customer savings still need measurement. Agent waiting time is separate.

The value is one coordinated workflow, from the first photo to an approved appointment.

We used Alike to share engineering decisions across coding sessions. Sparta Worlds tested our separate deposit-refund prototype against simulated Stripe under an injected error, improving passes from three of six to six of six. That prototype isn't connected to booking yet. [Sparta evidence](../sparta/evidence/summary.json)

We propose starting with property managers, where repairs repeat across units and the savings multiply. Revenue would come from per-unit subscriptions and booking fees. Next are verified provider discovery and measured savings, then expansion to homeowners.

Handy. A photo, an approval, and your time back.
