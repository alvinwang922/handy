import { z } from "zod";

const ConnectionMethod = z.object({
  protocol: z.enum(["MCP", "A2A", "WEBMCP"]),
  environment: z.enum(["remote_client", "browser_session"]),
  endpointUrl: z.string().nullable(),
  endpointStatus: z.enum(["not_published", "verified"]),
  documentationUrl: z.string(),
});

export const SearchResponseSchema = z.object({
  searchId: z.string().min(1).max(200),
  responseId: z.string().min(1).max(200),
  previousResponseId: z.string().nullable(),
  contractVersion: z.literal("search-v3.0"),
  status: z.enum(["completed", "needs_input", "no_match"]),
  searchToken: z.string().optional(),
  response: z.object({
    agents: z.array(z.object({
      agentId: z.string().min(1).max(200),
      capabilityId: z.string().min(1).max(200),
      capabilityRevision: z.number().int().positive(),
      rank: z.number().int().positive(),
      selected: z.boolean(),
      name: z.string().min(1).max(500),
      description: z.string().nullable(),
      reasons: z.array(z.string()).max(3),
      uncertainties: z.array(z.string()).max(3),
      readiness: z.enum(["ready", "authentication_required", "recheck_required", "unavailable"]),
      canStartThread: z.boolean(),
      canAttemptThread: z.boolean().optional(),
      providerCheck: z.enum(["not_attempted", "confirmed", "unconfirmed", "unavailable"]),
      requiredSetup: z.object({
        kind: z.enum(["credential", "installation", "provider_configuration"]),
        suppliedBy: z.enum(["user", "provider", "runtime"]),
        description: z.string(),
      }).nullable(),
      executionRequirements: z.unknown().optional(),
      executionGuidance: z.unknown().optional(),
      connectionMethods: z.array(ConnectionMethod).max(3),
      connectionPrompt: z.string().min(1),
    })).max(20),
    question: z.string().nullable(),
    noMatchReason: z.string().nullable(),
    overview: z.string().nullable().optional(),
    assessment: z.object({
      outcome: z.enum(["strong", "partial", "clarify", "no_match", "unverified"]),
      explanation: z.string(),
    }).optional(),
  }),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// Only these fixed synthetic descriptions can leave the prototype. No customer data is accepted.
export const SCENARIOS = {
  plumber: {
    trade: "plumber", city: "San Francisco", region: "CA", problem: "a routine dripping sink drain",
  },
  hvac: {
    trade: "HVAC", city: "Oakland", region: "CA", problem: "routine home air-filter replacement",
  },
  directory: {
    trade: "plumber", city: "San Francisco", region: "CA", problem: "synthetic local-business directory lookup",
  },
} as const;

export type Scenario = keyof typeof SCENARIOS;

export function searchRequest(scenario: Scenario) {
  if (scenario === "directory") {
    return {
      query: "Find an agent or API that can search Google Maps or a local business directory by business category and city, returning business names, websites and phone numbers. Lookup only; no contacting, booking or payment.",
      maxResults: 5,
    };
  }
  const item = SCENARIOS[scenario];
  return {
    query: `Find an agent or API capability that can look up local ${item.trade} businesses serving ${item.city}, ${item.region}, for ${item.problem}. It should return business names, official websites, business phone numbers and sources for service-area coverage. Lookup only; do not contact businesses, book appointments or make payments.`,
    maxResults: 5,
  };
}

// A compact display projection, never a trusted instruction or executable connection.
export function summarizeSearch(result: SearchResponse, mode: "fixture" | "live", scenario: Scenario) {
  const privateValues = result.searchToken ? [result.searchToken] : [];
  const safe = (value: string | null | undefined, limit = 300): string | null => {
    if (value == null) return null;
    let text = value;
    for (const secret of privateValues) text = text.split(secret).join("[redacted]");
    text = text.replace(/\b(?:sk[_-](?:live[_-]|test[_-])?|sk-ant-)[A-Za-z0-9_-]{8,}/gi, "[redacted]")
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ");
    return text.slice(0, limit);
  };
  const publicUrl = (value: string | null): string | null => {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      // Query strings and fragments may contain access material; never put them in console output.
      return safe(`${url.origin}${url.pathname}`, 500);
    } catch { return null; }
  };

  return {
    mode,
    scenario,
    status: result.status,
    searchId: safe(result.searchId, 200),
    responseId: safe(result.responseId, 200),
    assessment: result.response.assessment ? {
      outcome: result.response.assessment.outcome,
      explanation: safe(result.response.assessment.explanation, 600),
    } : null,
    question: safe(result.response.question, 500),
    noMatchReason: safe(result.response.noMatchReason, 500),
    candidates: result.response.agents.map((agent) => ({
      agentId: safe(agent.agentId, 200),
      capabilityId: safe(agent.capabilityId, 200),
      capabilityRevision: agent.capabilityRevision,
      name: safe(agent.name, 180),
      description: safe(agent.description, 400),
      rank: agent.rank,
      selected: agent.selected,
      readiness: agent.readiness,
      canStartThread: agent.canStartThread,
      providerCheck: agent.providerCheck,
      reasons: agent.reasons.map((reason) => safe(reason)),
      uncertainties: agent.uncertainties.map((reason) => safe(reason)),
      requiredSetup: agent.requiredSetup ? { ...agent.requiredSetup, description: safe(agent.requiredSetup.description) } : null,
      connectionMethods: agent.connectionMethods.map((method) => ({
        protocol: method.protocol,
        environment: method.environment,
        endpointStatus: method.endpointStatus,
        endpointUrl: publicUrl(method.endpointUrl),
        documentationUrl: publicUrl(method.documentationUrl),
      })),
      handoff: {
        routeStatus: agent.connectionMethods.some((method) => method.endpointStatus === "verified" && publicUrl(method.endpointUrl))
          ? "published_endpoint_needs_verification" : "verified_endpoint_absent",
        integrationStatus: "not_configured",
        execution: "not_attempted",
        callable: false,
        requiredNextStep: "Verify the lookup operation and obtain sourced business identity, phone and service-area evidence.",
      },
    })),
    callableProviders: [],
    note: "Capability discovery only. No Act, provider connection, phone call, booking or payment was attempted. Display URLs omit query strings and fragments; use current official docs to verify a route.",
  };
}

