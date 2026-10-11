import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SearchResponseSchema, searchRequest, summarizeSearch, type Scenario } from "./contract";
import { fixture } from "./fixture";

const SEARCH_URL = "https://api.darwin.so/api/v3/search";
export class DiscoveryError extends Error {}

export async function runDiscovery(options: {
  liveSearch?: boolean;
  scenario?: Scenario;
  fetch?: typeof fetch;
  privateDirectory?: string;
} = {}) {
  const scenario = options.scenario ?? "plumber";
  if (!options.liveSearch) return summarizeSearch(SearchResponseSchema.parse(fixture), "fixture", scenario);

  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(searchRequest(scenario)),
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
  } catch {
    throw new DiscoveryError("Darwin Search could not complete within the request limit. No provider action was attempted.");
  }
  if (!response.ok) {
    // The remote body may reflect credentials or untrusted input. Never log it.
    throw new DiscoveryError(`Darwin Search returned HTTP ${response.status}. No provider action was attempted.`);
  }
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new DiscoveryError("Darwin Search returned an unreadable response."); }
  const privateDirectory = options.privateDirectory ?? path.resolve("prototypes/darwin-discovery/.local");
  const runId = randomUUID();
  try {
    fs.mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
    fs.chmodSync(privateDirectory, 0o700);
    const destination = path.join(privateDirectory, `${runId}.json`);
    fs.writeFileSync(destination, JSON.stringify({
      capturedAt: new Date().toISOString(), scenario,
      request: searchRequest(scenario), response: raw,
    }, null, 2), { mode: 0o600, flag: "wx" });
  } catch {
    throw new DiscoveryError("Search succeeded but private recovery storage failed. No response body or ownership token was printed.");
  }
  // Retain the private response before parsing so API changes can be inspected without re-querying.
  const parsed = SearchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 8).map((issue) => `${issue.code}:${issue.path.join(".")}`).join(", ");
    throw new DiscoveryError(`Darwin Search returned an unsupported v3 response shape (${issues}). Private run ${runId}; no provider was promoted.`);
  }
  return { ...summarizeSearch(parsed.data, "live", scenario), privateRunId: runId };
}

