# Handy — Hackathon Product Requirements Document

**Status:** Hackathon MVP  
**Product:** AI-assisted home repair coordination for homeowners and property managers  
**Prototype:** [handy-repair-review.humblelarch64.chatgpt.site](https://handy-repair-review.humblelarch64.chatgpt.site)  
**Repository:** [github.com/alvinwang922/handy](https://github.com/alvinwang922/handy)

## 1. Product summary

Handy turns a photo and short description of a home issue into a confirmed repair appointment. It helps identify the likely issue, finds suitable service providers, calls them to clarify the job and collect estimates, presents comparable options, and schedules the selected provider after the user approves the quote and supplies available times.

## 2. Problem

Homeowners and property managers spend too much time figuring out what is wrong, finding qualified professionals, repeating the same details, comparing inconsistent estimates, and coordinating schedules. The process is fragmented across search, phone calls, text messages, notes, and calendars. Users also need clear control over price, provider choice, property access, and any commitment made on their behalf.

## 3. Target users

- **Homeowner:** Needs occasional help diagnosing and arranging non-emergency repairs.
- **Property manager:** Coordinates repairs across multiple properties, tenants, owners, and vendors.
- **Service provider:** Needs a clear repair brief, photos, access details, and a fast way to quote and confirm availability.

## 4. Product principles

1. **The user approves every commitment.** Handy may research and request estimates, but it cannot hire, pay, or schedule until the user approves.
2. **Assessment is preliminary.** A professional confirms the diagnosis and final scope.
3. **The repair has one source of truth.** Photos, calls, quotes, approvals, and appointments remain attached to one request.
4. **Automation stays visible.** Users can review transcripts, status changes, and the reason behind a recommendation.
5. **Urgent hazards exit the normal flow.** Gas smells, fire, electrical danger, and major flooding direct the user to emergency or utility services.

## 5. Core user journey

1. The user selects a property, adds photos, and describes the problem.
2. Handy returns a likely issue, confidence level, recommended trade, and safety guidance.
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
- For the hackathon demo, **Add a sample photo** attaches a mock kitchen-sink leak and fills sample details.
- Produce a preliminary issue summary, recommended professional category, and proposed scope.
- Display a clear warning that the professional must confirm the diagnosis.

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

### Darwin — agentic web discovery track

**Product role:** Find service capabilities and initiate provider-agent interactions.

- Search Darwin for agents or services that match a repair capability such as plumbing, HVAC, or general handyman work.
- Preserve the selected capability ID and revision so the choice is reproducible.
- Start a protected thread only when a selected service requires an authenticated interaction.
- Fall back to a seeded provider directory when no suitable live capability exists, while labeling the fallback clearly.

**Demo moment:** Show the exact request—“find plumbing services that can quote a leaking sink in this service area”—and the selected result feeding the outreach queue.

**Why it fits:** Darwin exposes public capability search plus protected thread tools through MCP, skills, REST, TypeScript, Python, and CLI surfaces. See [Darwin for agents](https://darwin.so/agents).

### Keewano — event data and agent analytics track

**Product role:** The ordered, queryable history of every repair.

- Record `issue.created`, `photo.added`, `assessment.proposed`, `provider.discovered`, `call.completed`, `quote.received`, `quote.approved`, `availability.submitted`, and `appointment.confirmed` events.
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

Use all four sponsors in one connected product flow, while concentrating the live demo on this chain:

**Darwin discovers → Dial contacts → Keewano records → user approves → Dial schedules**

Use **Alike** to demonstrate the repair handoff and the team’s own human-agent coordination. This gives every sponsor a clear role without making the customer journey feel like four disconnected demos.

## 9. System outline

```text
Handy web app
    ↓
Repair orchestrator
    ├─ assessment model: issue summary and trade classification
    ├─ Darwin: provider/agent discovery
    ├─ Dial: calls, SMS, transcripts, confirmations
    ├─ KeewanoDB: ordered repair events and analytics
    └─ Alike: human/agent repair briefs and handoffs
```

## 10. Data objects

- **Property:** address, unit, manager, resident, access policy.
- **Repair request:** description, photos, room, urgency, assessment, status.
- **Provider:** identity, capabilities, service area, rating source, contact method.
- **Outreach attempt:** channel, timestamp, outcome, transcript reference.
- **Quote:** provider, scope, estimate, conditions, warranty, availability, expiration.
- **Approval:** user, quote, amount, timestamp, consent text.
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

The pilot target is a **50% reduction in active coordination time**. This is a product goal to validate, not an established result.

## 12. Hackathon acceptance criteria

- A user can complete the full demo from issue submission to appointment confirmation.
- At least one provider interaction uses Dial and returns a usable transcript.
- At least one discovery request uses Darwin or clearly displays the seeded fallback.
- Keewano stores and retrieves the ordered repair event sequence.
- Alike produces or maintains a repair/development handoff if its hackathon API is available.
- Every simulated or seeded element is labeled as demo data.
- No provider is hired or scheduled without an explicit approval event.

## 13. Non-goals for the hackathon

- Emergency dispatch.
- Guaranteed diagnosis from photos.
- Nationwide provider coverage or automated license verification.
- Binding fixed-price quotes for work that requires inspection.
- Insurance claims, permits, financing, or dispute resolution.
- Payments, deposits, or financing.

## 14. Risks and mitigations

- **Provider does not answer:** retry within a limit, switch to SMS, then contact the next provider.
- **Quote is not comparable:** enforce a structured question set and display missing fields.
- **Assessment is wrong:** label it preliminary and require professional confirmation.
- **The agent overcommits:** enforce approval gates in application logic and write every approval and external action to Keewano’s event trail.
- **Sensitive property data is overshared:** withhold exact address and tenant contact details until required, and log every disclosure.
- **Sponsor service is unavailable:** use a clearly labeled seeded provider or simulated call while preserving the same event contract.

## 15. Three-minute demo script

1. Switch between homeowner and property-manager workspaces.
2. Report a leaking sink and attach the sample photo.
3. Show the assessment and Darwin provider discovery result.
4. Trigger Dial outreach and open the returned call transcript.
5. Compare quotes and approve one provider.
6. Select two available windows and use Dial to confirm the appointment.
7. Query Keewano for the repair timeline and funnel.
8. End on the confirmed appointment and Alike handoff/status brief.
