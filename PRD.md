# Handy — Hackathon Product Requirements Document

**Status:** Hackathon MVP  
**Product:** AI-assisted home repair coordination for homeowners and property managers  
**Prototype:** [handy-repair-review.humblelarch64.chatgpt.site](https://handy-repair-review.humblelarch64.chatgpt.site)  
**Repository:** [github.com/alvinwang922/handy](https://github.com/alvinwang922/handy)

## 1. Product summary

Handy turns a photo and short description of a home issue into a suitable repair path: a professional appointment or a simple guided DIY fix. It assesses whether a handyman is needed. For a low-risk fix, it recommends a compatible part, presents purchase options for approval, and guides installation once the part arrives. When professional help is needed or preferred, it finds providers, collects estimates, and schedules the user's approved choice.

## 2. Problem

Homeowners and property managers spend too much time figuring out what is wrong, finding qualified professionals, repeating the same details, comparing inconsistent estimates, and coordinating schedules. The process is fragmented across search, phone calls, text messages, notes, and calendars. Users also need clear control over price, provider choice, property access, and any commitment made on their behalf.

Sometimes a service visit is unnecessary: the issue only needs an inexpensive replacement part and a straightforward installation. Users need help identifying the right part and understanding whether they can comfortably complete the repair themselves.

## 3. Target users

- **Homeowner:** Needs occasional help diagnosing and arranging non-emergency repairs.
- **Property manager:** Coordinates repairs across multiple properties, tenants, owners, and vendors.
- **Service provider:** Needs a clear repair brief, photos, access details, and a fast way to quote and confirm availability.

## 4. Product principles

1. **The user approves every commitment.** Handy may research and request estimates, but it cannot hire, order parts, pay, or schedule until the user approves the specific commitment.
2. **Assessment is preliminary.** Handy checks compatibility and suitability before suggesting DIY; uncertain or complex issues go to a professional for confirmation.
3. **The repair has one source of truth.** Photos, calls, quotes, parts, orders, instructions, approvals, and appointments remain attached to one request.
4. **Automation stays visible.** Users can review transcripts, status changes, and the reason behind a recommendation.
5. **Urgent hazards exit the normal flow.** Gas smells, fire, electrical danger, and major flooding direct the user to emergency or utility services.
6. **DIY is optional.** Recommend it only for simple, low-risk work with clear instructions. The user can always choose professional help.

## 5. Core user journey

1. The user selects a property, adds photos, and describes the problem.
2. Handy returns a likely issue, confidence level, safety guidance, and a recommended path: simple DIY or professional help.

**Simple DIY path**

3. If the fix is low risk, Handy explains why a service visit may be unnecessary and asks for any missing model, measurements, or photos needed to confirm the part.
4. The user compares compatible parts by seller, total cost, delivery estimate, and return policy, then explicitly confirms the selected purchase or completes the seller's checkout.
5. Handy tracks the order when supported, or lets the user mark the part as arrived.
6. Once it arrives, Handy presents instructions for that exact part, with required tools, preparation, step-by-step installation, and a completion check.
7. The user marks the repair resolved or switches to professional help with the existing issue and attempted steps preserved.

**Professional-help path**

3. Handy finds providers that serve the area and can handle the job.
4. Handy calls providers with a consistent repair brief and records scope, estimate, conditions, and availability.
5. The user compares normalized quotes and opens the supporting call transcript.
6. The user approves one provider and the estimated price.
7. The user supplies acceptable time windows and access instructions.
8. Handy calls or messages the provider to confirm an appointment.
9. The user receives a confirmation and can reschedule, track, or mark the repair complete.

## 6. MVP requirements

### Issue intake and assessment

- Accept one or more photos, a short description, property, room, and urgency.
- The demo accepts real photos; clearly label any simulated assessment or downstream action.
- Produce a preliminary issue summary, recommended DIY or professional path, and proposed scope.
- Ask clarifying questions when photos and description do not establish the issue or part compatibility.
- Explain uncertainty and when professional confirmation is needed.

### Simple DIY, parts, and guided installation

- Recommend DIY only when the task is simple, low risk, and suitable for the user's comfort level; show expected effort and tools before the user chooses.
- Identify the required part and compatibility evidence, such as manufacturer/model, dimensions, or connection type. Do not present an unverified match as confirmed.
- Show available purchase options with the exact item/variant, seller link, quantity, price, shipping and taxes when available, delivery estimate, and return policy. Label unknown costs.
- Require explicit confirmation of the selected item and final total before placing an order. Material changes to the item, price, or delivery terms require renewed approval. A checkout handoff is not an order confirmation.
- Keep order status and delivery information on the repair request. Support a manual **Part arrived** action if tracking is unavailable.
- After arrival, show part-specific steps grounded in manufacturer instructions, including preparation, tools, illustrations when available, and a final function check. Let the user pause and resume.
- Provide a **Get professional help** option throughout. If the part does not fit, instructions are unclear, or the issue persists, stop the DIY flow and carry its history into the provider brief.

### User stories for the DIY path

- **Homeowner:** As a homeowner, I want to know when a repair is simple enough to do myself so I can avoid an unnecessary service visit.
- **Buyer:** As a user, I want compatible part options and a clear total to approve so Handy cannot order the wrong item or spend without my consent.
- **Installer:** As a user, I want step-by-step instructions once the part arrives so I can complete the repair and check whether it worked.
- **Property manager:** As a manager, I want parts, approvals, delivery, and repair progress tied to the correct property/unit, with a named person who has agreed to install the part.

### Provider discovery and outreach

- Search for at least three relevant providers or provider agents.
- Filter by trade, service area, availability, and ability to provide an estimate.
- Send every provider the same structured repair brief.
- Capture call status and transcript, including unanswered or failed calls.

### Quote comparison and approval

- Normalize each response into provider, scope, estimated total, parts/labor notes, availability, warranty, and conditions.
- Label estimates as provisional when an inspection is required.
- Show the lowest price and a recommended match with an explanation.
- Require explicit user approval before selecting a provider.

### Scheduling

- Let the user provide multiple appointment windows and access instructions.
- Call or message the approved provider to negotiate a matching window.
- Store the confirmed provider, time, property, estimate, and instructions.
- Support rescheduling without changing the approved provider or price unless the user chooses to reopen quoting.

### Property-manager workspace

- Organize repair requests and appointments by property and unit.
- Include tenant name and access notes only when required for coordination.
- Filter the repair queue by property and status.
- Keep an activity trail for accountability between tenant, manager, provider, and agent.

## 7. Sponsor stack and hackathon tracks

### Dial — communication and voice agent track

**Product role:** The core provider-contact layer.

- Give Handy a dedicated phone number.
- Use an AI voice call to explain the repair, ask clarifying questions, request an estimate, and capture availability.
- Retrieve the completed call status, duration, and transcript.
- Use SMS for a written quote summary and appointment confirmation when appropriate.
- Use a second call or message only after user approval to schedule the selected provider.

**Demo moment:** Open a repair, press **Get quotes**, show one real or sandboxed Dial call, then display its transcript as a structured quote. After approval, show the scheduling call and resulting confirmation.

**Why it fits:** Dial documents voice calls, SMS, inbound events, phone-number provisioning, transcripts, and MCP/SDK/REST access for agents. See [Dial introduction](https://docs.getdial.ai/documentation/get-started/introduction) and [agent integration options](https://docs.getdial.ai/documentation/get-started/using-dial-from-an-agent).

### Keewano — event data and agent analytics track

**Product role:** The ordered, queryable history of every repair.

- Record `issue.created`, `photo.added`, `assessment.proposed`, `provider.discovered`, `call.completed`, `quote.received`, `quote.approved`, `availability.submitted`, and `appointment.confirmed` events.
- For DIY, also record `diy.recommended`, `part.selected`, `order.approved`, `order.confirmed`, `part.arrived`, `installation.step.completed`, `repair.resolved`, and `diy.escalated`.
- Use the repair ID, property ID, provider ID, and user ID as entities.
- Reconstruct the full repair timeline from ordered events.
- Query hackathon metrics such as time to first quote, quote-to-booking conversion, provider response rate, and active coordination time.
- Let the agent answer questions such as “Which providers respond fastest to plumbing requests?” from the raw event record.

**Demo moment:** Complete a repair flow, then query the full timeline and a small funnel: issue submitted → quote received → quote approved → appointment confirmed.

**Why it fits:** Keewano exposes complete ordered event sequences, entity timelines, funnels, KPIs, SQL, and agent-facing MCP tools. See [Keewano MCP for agents](https://www.keewano.com/mcp-for-agents).

### Alike — human and agent coordination track

**Product role:** Coordinate the people and agents handling a repair without exposing unnecessary raw messages.

- Create a shared repair brief from the issue, current status, approvals, and next action.
- Keep the property manager, tenant coordinator, and AI agents aligned on ownership and blockers.
- Pass structured context between the discovery, calling, quoting, and scheduling agents.
- Log coordination actions and preserve visibility boundaries by role.
- Use Alike during the hackathon to coordinate development ownership, decisions, and handoffs between teammates and coding agents.

**Demo moment:** Show a repair handoff from quote collection to scheduling with the approved quote, permitted contact details, and next action already attached.

**Integration note:** Alike publicly describes connections to calendars, email, messages, and meeting notes, plus traceable coordination and access boundaries. Confirm the hackathon-specific API or MCP surface with the sponsor before promising an in-product integration. If no product API is available, present Alike as the team coordination layer and do not claim a runtime integration. See [Alike](https://alike.work/).

## 8. Recommended track strategy

Concentrate the live product demo on this chain:

**Seeded provider directory → Keewano ranks → Dial contacts → user approves → Dial schedules**

Use **Alike** to demonstrate the team’s own human-agent coordination and development handoffs. Provider names and history in the demo are seeded and must be labeled; automatic local-business discovery remains future work.

## 9. System outline

```text
Handy web app
    ↓
Repair orchestrator
    ├─ assessment model: issue summary, DIY suitability, and trade classification
    ├─ parts workflow: compatibility, purchase options, approval, and order status
    ├─ installation guide: part-specific steps and completion checks
    ├─ provider directory: seeded demo contacts, trade and service-area filtering
    ├─ Dial: calls, SMS, transcripts, confirmations
    ├─ KeewanoDB: ordered repair events and analytics
    └─ Alike: human/agent repair briefs and handoffs
```

## 10. Data objects

- **Property:** address, unit, manager, resident, access policy.
- **Repair request:** description, photos, room, urgency, assessment, chosen path (DIY/professional), status.
- **Part option:** manufacturer/model, variant, compatibility evidence, seller link, quantity, cost breakdown, delivery estimate, return policy.
- **Part order:** repair ID, selected option, approval, confirmed total, merchant order reference, delivery status; distinguish checkout pending from ordered.
- **Installation guide:** part/model, source instructions, required tools, steps, progress, assigned installer, completion check, escalation reason.
- **Provider:** identity, capabilities, service area, rating source, contact method.
- **Outreach attempt:** channel, timestamp, outcome, transcript reference.
- **Quote:** provider, scope, estimate, conditions, warranty, availability, expiration.
- **Approval:** user, action (provider selection/booking/part purchase), exact quote or part-option version, amount, timestamp, consent text.
- **Appointment:** provider, property, time window, access instructions, status.
- **Event:** entity, event type, actor, timestamp, payload, source reference.

## 11. Success metrics

- Median active user time from issue submission to approved provider.
- Median time to first usable quote.
- Percentage of requests receiving two or more comparable quotes.
- Quote approval-to-booking completion rate.
- Provider response and call-completion rates.
- Percentage of agent actions with a complete source event and approval record.
- User satisfaction after booking and after repair completion.
- Percentage of DIY-eligible requests resolved without a professional visit, and percentage escalated to a professional.
- Part compatibility/return rate and time from part arrival to repair resolution.
- User-reported time and cost saved through DIY, with the comparison basis recorded; do not count an incomplete repair as a saved visit.

The pilot target is a **50% reduction in active coordination time**. This is a product goal to validate, not an established result.

## 12. Hackathon acceptance criteria

- A user can complete the full demo from issue submission to appointment confirmation.
- At least one provider interaction uses Dial and returns a usable transcript.
- Provider selection uses trade/service-area filtering and Keewano ranking, with seeded demo providers clearly labeled.
- Keewano stores and retrieves the ordered repair event sequence.
- Alike produces or maintains a repair/development handoff if its hackathon API is available.
- Every simulated or seeded element is labeled as demo data.
- No provider is hired or scheduled without an explicit approval event.
- A second demo scenario branches into DIY, presents compatible part options, captures purchase approval, and shows installation steps after **Part arrived**.
- Any simulated purchase or delivery is clearly labeled. Live checkout requires explicit approval of the final item and total, and only a merchant confirmation marks an order placed.
- A user can switch from DIY to professional help without re-entering the issue or losing the repair history.

## 13. Non-goals for the hackathon

- Emergency dispatch.
- Guaranteed diagnosis from photos.
- Nationwide provider coverage or automated license verification.
- Binding fixed-price quotes for work that requires inspection.
- Insurance claims, permits, financing, or dispute resolution.
- In-app payment processing, contractor deposits, or financing. Parts purchases may hand off to merchant checkout; a simulated hackathon order must be labeled.
- Complex or hazardous DIY work, or instructions unsupported by the identified part's documentation.

## 14. Risks and mitigations

- **Provider does not answer:** retry within a limit, switch to SMS, then contact the next provider.
- **Quote is not comparable:** enforce a structured question set and display missing fields.
- **Assessment is wrong:** label it preliminary; ask for missing evidence and route uncertain or complex repairs to professional confirmation.
- **Wrong part or unsuitable DIY task:** verify compatibility, expose uncertainty, use manufacturer instructions, and offer professional help at every stage.
- **Purchase terms change:** refresh the item and final total before approval; request renewed approval for material changes and retain the order confirmation.
- **The agent overcommits:** enforce approval gates in application logic and write every approval and external action to Keewano’s event trail.
- **Sensitive property data is overshared:** withhold exact address and tenant contact details until required, and log every disclosure.
- **Sponsor service is unavailable:** use a clearly labeled seeded provider or simulated call while preserving the same event contract.

## 15. Three-minute demo script

1. Switch between homeowner and property-manager workspaces.
2. Report a leaking sink and attach a photo.
3. Show the assessment and relevant seeded providers ranked by Keewano.
4. Trigger Dial outreach and open the returned call transcript.
5. Compare quotes and approve one provider.
6. Select two available windows and use Dial to confirm the appointment.
7. Query Keewano for the repair timeline and funnel.
8. End on the confirmed appointment and Alike handoff/status brief.

**Alternate DIY demo:** Report a simple broken cabinet knob → confirm its dimensions → compare compatible replacements → approve a clearly labeled demo order → mark the part arrived → follow installation steps → mark the repair resolved. Show the professional-help fallback.
