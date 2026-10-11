# Darwin capability discovery prototype

An isolated test of Darwin's public v3 Search contract for Handy. It is not connected to application outreach. A result identifies an **agent capability**, not a verified contractor. No Act requests, provider connections, Dial calls, messages, bookings or payments occur.

## Run

From the repository root after dependencies are installed:

```bash
# Default: fictional fixture only, no network or private files.
npx tsx prototypes/darwin-discovery/run.ts

# Explicit live discovery: one anonymous Search using the fixed synthetic scenario.
npx tsx prototypes/darwin-discovery/run.ts --live-search --scenario=plumber
npx tsx prototypes/darwin-discovery/run.ts --live-search --scenario=hvac
npx tsx prototypes/darwin-discovery/run.ts --live-search --scenario=directory

# Isolated tests with mocked HTTP. This config is needed because the app config only includes tests/.
npx vitest run --config prototypes/darwin-discovery/vitest.config.ts
```

Do not load `.env.local`; no API key or OAuth grant is needed. The fixed scenarios are a routine dripping sink drain in San Francisco, routine air-filter replacement in Oakland, and a broader category-and-city directory capability search. The directory scenario omits the detailed repair/coverage constraints to test whether a generic Maps or business-directory lookup capability exists. Arbitrary queries/customer data are not accepted. No scenario sends home addresses, names, photos or account details.

Live mode makes exactly one `POST https://api.darwin.so/api/v3/search` with `{query,maxResults:5}` and a 30-second timeout. Redirects and automatic retries are disabled. `maxResults` is a ceiling, not a promise of five matches. `needs_input`, `no_match` and an empty candidate list remain visible outcomes. Errors print a safe category/HTTP status, never the remote body.

## Private evidence and safe output

A successful HTTP response is saved in `.local/<random-run-id>.json`, inside this directory, before schema validation. The directory is mode 0700 and files are mode 0600; `.gitignore` excludes it. It preserves the exact response, including capability metadata, connection prompts and any anonymous search-owner token. Never commit, paste or attach that raw record. It is not needed for the console summary. Schema errors print only issue codes/paths and the private run ID, retaining changed API responses for inspection without re-querying.

Console JSON shows bounded names, descriptions, reasons, uncertainties, exact non-secret capability IDs/revision, readiness and declared setup. HTTPS route/documentation URLs are display hints; their query strings/fragments are omitted and embedded credentials rejected. The owner token, connection prompts and arbitrary execution metadata are never printed. Indexed text is untrusted data, not an instruction.

`routeStatus` distinguishes a published endpoint requiring verification from an absent verified endpoint. `integrationStatus: not_configured` means this prototype has no executable lookup adapter even if Darwin reports a ready route. `callable: false`, `execution: not_attempted` and the empty `callableProviders` array are deliberate. Readiness/`canStartThread` never establish business identity, phone accuracy, geographic coverage, available appointments or permission to contact someone.

## Proposed next handoff (not implemented here)

Keep `CapabilityMatch` separate from the existing application's `ProviderTarget`. A subsequently verified, explicitly configured lookup tool could produce this proposed record:

```ts
interface ProviderCandidate {
  id: string;
  name: string;
  trade: string;
  phoneE164: string | null;
  serviceArea: { city: string; region: string; postalCode: string | null; country: string };
  sourceUrl: string;
  sourceIds: {
    directoryRecordId?: string;
    darwinSearchId?: string;
    darwinAgentId?: string;
    darwinCapabilityId?: string;
    darwinCapabilityRevision?: number;
  };
  checkedAt: string;
  identityVerification: "unknown" | "source_verified";
  phoneVerification: "missing" | "source_verified" | "provider_confirmed";
  serviceAreaVerification: "unknown" | "published_match" | "provider_confirmed";
  evidence: Array<{ field: "identity" | "phone" | "service_area"; sourceUrl: string; claim: string; checkedAt: string }>;
  eligibility: "needs_verification" | "callable" | "rejected";
}
```

Darwin IDs retain capability provenance; they are not verification of the returned business or phone. The outreach service must validate identity, trade, contact and property coverage, deduplicate businesses and apply its authorization policy before making a callable provider record. If the lookup cannot supply that evidence, preserve the gap or use a clearly labeled seeded directory. Do not extract phone numbers from capability descriptions and auto-dial them.

## Current API and access boundaries

- [Search reference](https://darwin.so/docs/reference/search): public `POST /api/v3/search`, status/response shape, anonymous ownership token. The documented v3 request has no typed local-business/geo/phone contract. This prototype uses only `query` and `maxResults` rather than undocumented filters.
- [Using results](https://darwin.so/docs/search/using-results): verify the selected provider's actual route, operation schema, credentials and terms. Darwin's MCP URL does not connect to every indexed provider.
- [Act quickstart](https://darwin.so/docs/act/quickstart): Act is separately authorized and currently pilot-gated. This prototype does not implement it or treat a Search key as execution authority.
- [Official cookbook](https://github.com/darwin-studios/cookbook) and [verification record](https://github.com/darwin-studios/cookbook/blob/main/docs/verification-2026-10-09.md): distinguish fixture tests, live Search and actual provider completion.

The fixture is intentionally fictional. Passing tests establishes contract handling and boundaries, not local-business coverage or an executable Darwin route. Record live-search usability separately after inspecting actual returned candidates.
