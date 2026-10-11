import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoveryError, runDiscovery } from "./client";
import { SearchResponseSchema, searchRequest, summarizeSearch } from "./contract";
import { fixture } from "./fixture";

const privateDirectories: string[] = [];
const privateDirectory = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "handy-darwin-test-"));
  privateDirectories.push(directory);
  return directory;
};
afterEach(() => { for (const directory of privateDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

describe("isolated Darwin capability discovery", () => {
  it("supports a fixed broader directory search without customer details or outreach", () => {
    expect(searchRequest("directory")).toEqual({
      query: "Find an agent or API that can search Google Maps or a local business directory by business category and city, returning business names, websites and phone numbers. Lookup only; no contacting, booking or payment.",
      maxResults: 5,
    });
  });

  it("uses a fixture without contacting any network or writing a recovery file by default", async () => {
    const fetch = vi.fn();
    const directory = privateDirectory();
    const result = await runDiscovery({ fetch, privateDirectory: directory });
    expect(fetch).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(result.mode).toBe("fixture");
    expect(result.callableProviders).toEqual([]);
  });

  it("sends one anonymous synthetic v3 Search request and privately persists its owner token", async () => {
    const raw = { ...structuredClone(fixture), searchToken: "test-owner-token-not-for-console" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw)));
    const directory = privateDirectory();
    const result = await runDiscovery({ liveSearch: true, scenario: "hvac", fetch, privateDirectory: directory });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.darwin.so/api/v3/search");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toEqual(searchRequest("hvac"));
    expect(Object.keys(JSON.parse(init.body))).toEqual(["query", "maxResults"]);
    expect(JSON.stringify(result)).not.toContain(raw.searchToken);
    const files = fs.readdirSync(directory);
    expect(files).toHaveLength(1);
    const recordPath = path.join(directory, files[0]);
    expect(JSON.parse(fs.readFileSync(recordPath, "utf8")).response.searchToken).toBe(raw.searchToken);
    expect(fs.statSync(recordPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
  });

  it("retains no-match and clarification results without inventing candidates", () => {
    for (const status of ["no_match", "needs_input"] as const) {
      const raw = structuredClone(fixture);
      raw.status = status;
      raw.response.agents = [];
      raw.response.question = status === "needs_input" ? "Which city?" : null;
      raw.response.noMatchReason = status === "no_match" ? "No matching capability." : null;
      const result = summarizeSearch(SearchResponseSchema.parse(raw), "live", "plumber");
      expect(result.status).toBe(status);
      expect(result.candidates).toEqual([]);
      expect(result.callableProviders).toEqual([]);
    }
  });

  it("never promotes a ready capability or published route to a callable business", () => {
    const raw = structuredClone(fixture);
    const agent = raw.response.agents[0];
    agent.readiness = "ready";
    agent.canStartThread = true;
    agent.providerCheck = "confirmed";
    agent.connectionMethods[0] = {
      protocol: "MCP", environment: "remote_client", endpointStatus: "verified",
      endpointUrl: "https://lookup.example.com/mcp", documentationUrl: "https://lookup.example.com/docs",
    };
    const result = summarizeSearch(SearchResponseSchema.parse(raw), "live", "plumber");
    expect(result.candidates[0]).toMatchObject({
      agentId: agent.agentId, capabilityId: agent.capabilityId, capabilityRevision: 1,
      handoff: { routeStatus: "published_endpoint_needs_verification", integrationStatus: "not_configured", callable: false, execution: "not_attempted" },
    });
    expect(result.callableProviders).toEqual([]);
  });

  it("keeps unpublished routes and absent setup metadata unknown", () => {
    const result = summarizeSearch(SearchResponseSchema.parse(fixture), "fixture", "plumber");
    expect(result.candidates[0].requiredSetup).toBeNull();
    expect(result.candidates[0].connectionMethods[0].endpointUrl).toBeNull();
    expect(result.candidates[0].handoff.routeStatus).toBe("verified_endpoint_absent");
  });

  it("omits prompts, private fields, URL credentials and reflected tokens from public summaries", () => {
    const raw = structuredClone(fixture);
    raw.searchToken = "a-very-private-owner-token";
    const agent = raw.response.agents[0];
    agent.connectionPrompt = "Do not print this untrusted connection prompt";
    agent.reasons = [`Reflected ${raw.searchToken}`, "Bearer should-not-appear", "sk_live_examplecredential12345"];
    agent.executionRequirements = { secret: "private-requirements-value" };
    agent.connectionMethods = [
      { protocol: "MCP", environment: "remote_client", endpointStatus: "verified", endpointUrl: "https://example.com/mcp?token=never-log-me#fragment-secret", documentationUrl: "https://person:password@example.com/docs" },
    ];
    const summary = summarizeSearch(SearchResponseSchema.parse(raw), "live", "plumber");
    const output = JSON.stringify(summary);
    for (const secret of [raw.searchToken, "should-not-appear", "sk_live_examplecredential12345", "private-requirements-value", "never-log-me", "fragment-secret", "password", agent.connectionPrompt]) {
      expect(output).not.toContain(secret);
    }
    expect(summary.candidates[0].connectionMethods[0]).toMatchObject({ endpointUrl: "https://example.com/mcp", documentationUrl: null });
  });

  it("fails closed on a changed or malformed response without printing its values", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "private-malformed-token", response: { agents: [] } })));
    const directory = privateDirectory();
    await expect(runDiscovery({ liveSearch: true, fetch, privateDirectory: directory })).rejects.toThrow("unsupported v3 response shape");
    const files = fs.readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(directory, files[0]), "utf8")).response.token).toBe("private-malformed-token");
  });

  it("does not expose server error bodies or network exception details", async () => {
    const rejected = vi.fn().mockResolvedValue(new Response("secret-api-error-body", { status: 403 }));
    await expect(runDiscovery({ liveSearch: true, fetch: rejected })).rejects.toThrow(new DiscoveryError("Darwin Search returned HTTP 403. No provider action was attempted."));
    const interrupted = vi.fn().mockRejectedValue(new Error("credential-bearing-url"));
    await expect(runDiscovery({ liveSearch: true, fetch: interrupted })).rejects.toThrow(new DiscoveryError("Darwin Search could not complete within the request limit. No provider action was attempted."));
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(interrupted).toHaveBeenCalledTimes(1);
  });
});

