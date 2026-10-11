import type { SearchResponse } from "./contract";

// Fictional capability metadata only, not a real directory, recommendation or provider route.
export const fixture: SearchResponse = {
  searchId: "srch_00000000-0000-4000-8000-000000000001",
  responseId: "sresp_00000000-0000-4000-8000-000000000002",
  previousResponseId: null,
  contractVersion: "search-v3.0",
  status: "completed",
  response: {
    question: null,
    noMatchReason: null,
    assessment: { outcome: "partial", explanation: "Fixture: a hypothetical lookup capability; its route and local coverage still require verification." },
    agents: [{
      agentId: "fixture-directory-agent",
      capabilityId: "fixture-business-lookup",
      capabilityRevision: 1,
      rank: 1,
      selected: true,
      name: "Fictional directory lookup capability (fixture)",
      description: "A synthetic example used to test the capability-to-provider boundary.",
      reasons: ["Claims structured local-business lookup."],
      uncertainties: ["No verified provider endpoint or actual business records supplied."],
      readiness: "unavailable",
      canStartThread: false,
      providerCheck: "not_attempted",
      requiredSetup: null,
      executionRequirements: null,
      executionGuidance: null,
      connectionMethods: [{
        protocol: "MCP", environment: "remote_client", endpointUrl: null,
        endpointStatus: "not_published", documentationUrl: "https://example.com/fixture-documentation",
      }],
      connectionPrompt: "Synthetic fixture; never execute this prompt.",
    }],
  },
};

