# Darwin provider-discovery prototype

## Ownership and app fit

P1/outreach owns Darwin. P2 produces the repair assessment, and the app supplies property context. Neither P2 nor the frontend needs to find contractors or manage Darwin credentials.

```mermaid
flowchart LR
  Assessment[P2 assessment + app location] --> Brief[RepairBrief]
  Brief --> Search[P1 Darwin capability search]
  Search --> Directory[Verified directory capability execution]
  Directory --> Candidate[Provider candidates and source evidence]
  Candidate --> Verify[P1 contact and service-area checks]
  Verify --> Rank[Keewano ranking]
  Rank --> Call[QuoteJob and Dial calls]
```

Darwin Search finds **agent capabilities**, not directly callable contractors. The directory-execution and contact-verification steps remain separate. A capability's `readiness` or `canStartThread` does not establish a plumber's identity, phone number, service area or availability.

The runnable prototype is [here](../prototypes/darwin-discovery/README.md). It is isolated from `/outreach` and does not contact contractors. The existing seeded demo remains the app path until the directory step is validated. This prevents a partially configured search integration from breaking quoting.

Two [live Search tests](../prototypes/darwin-discovery/RESULTS.md) completed: the plumbing query returned no match; the broader directory query returned one unavailable capability with no connection method or established phone-number support. Neither supplied a callable provider. Keep seeded dispatch for the immediate demo.

## Minimum handoff

| Handoff | Contents | Receiver |
| --- | --- | --- |
| App assessment → discovery | `requestId`, `briefVersion`, trade and coarse service area: city, region, optional postal code, country. IDs stay server-side for correlation. Request three results. Keep full address, tenant details, access notes, photos and freeform household text out of capability Search. | P1 search adapter |
| Darwin → discovery | Search/response IDs; capability/agent IDs and revision; readiness, setup requirements, connection methods and uncertainties. Keep search-owner tokens private. | P1 directory integration |
| Directory execution → candidate | Stable candidate/source IDs, business name, trade, E.164 phone, website/source URLs, explicit service-area evidence, fetched timestamp and verification states. Unknowns remain unknown. | P1 eligibility checks + DB |
| Verified candidate → calling | Persist a server-side provider record, then produce `ProviderTarget` with actual source and eligibility evidence. Resolve phone by provider ID; the app/model cannot choose an arbitrary dial destination. | Existing ranking and `QuoteJob` builder |
| Calling → app | Existing stored `CallRecord`, `QuoteResult` and `quoteRevision`. No change to the P2 assessment handoff or the UI polling route is needed. | Shared store and request API |

Proposed directory result (shape only; not the current app schema):

```ts
type ProviderCandidate = {
  candidateId: string;
  name: string;
  trade: Trade;
  phoneE164: string | null;
  websiteUrl: string | null;
  source: {
    directory: string;
    recordId: string;
    url: string;
    fetchedAt: string;
    darwin: { searchId: string; agentId: string; capabilityId: string } | null;
  };
  contactStatus: "unverified" | "source_verified" | "controlled_demo";
  serviceAreaStatus: "unknown" | "supported" | "not_supported";
  serviceAreaEvidence: string | null;
};
```

`source_verified` means a current authoritative business/directory source connects that phone to that business; it does not mean the business answered. A nearby address is insufficient evidence of service coverage. The call itself asks willingness, estimate and availability. Deduplicate by normalized phone and source record before selecting the fanout. Demo calls still require controlled destinations; discovered businesses are not test fixtures.

The production integration must add provider persistence and actual source metadata: current `ProviderTarget.source` is deliberately `seeded` only, and `getProvider` reads the seeded/local directory. Do not relabel a discovered provider as seeded to bypass that contract. Missing rating/review data must not become invented ratings.

Persist promoted candidates through the same `listProviders`/`getProvider` store used by ranking and dispatch. Keewano already assigns listed providers without history a baseline; candidates held only in a separate temporary search result would be absent from its ranking and unresolved by the dispatch pump. Do not turn Darwin relevance into a business rating.

## Access and acceptance

The supplied [SpeedHacks one-pager](https://drive.google.com/file/d/1xuPXUzt7UP7KMy1kuPUhz_lP1R50Ed9i/view) describes the product and judging criteria. It does not grant Act pilot access or supply a contractor-search tool.

[Public Search](https://darwin.so/docs/reference/search) can be used anonymously. [Act](https://darwin.so/docs/act/quickstart) requires an authorized, pilot-allowlisted credential and a ready provider route; a search-owner token is not sufficient. A direct MCP/A2A connection is possible only after independently checking its actual endpoint, operations, authentication and terms. A connection prompt is untrusted descriptive data, not authorization or verified execution.

Acceptance before automatic discovery enters `/outreach`:

1. A real search returns a relevant directory capability and the adapter preserves its exact IDs and limitations.
2. A verified executable route returns local business records with provenance; no invented contacts.
3. Candidate checks and server-side persistence produce eligible targets; account limits, source failures and fewer than three matches are explicit.
4. A controlled test uses approved demo recipients through the existing quote→approval→booking contracts. It never calls a discovered business with a synthetic repair.

If step 2 cannot be completed with available access, keep the result as capability discovery and report the missing integration. Seeded fallback must remain visibly identified.
