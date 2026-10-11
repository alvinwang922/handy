import { DiscoveryError, runDiscovery } from "./client";
import { SCENARIOS, type Scenario } from "./contract";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: tsx prototypes/darwin-discovery/run.ts [--live-search] [--scenario=plumber|hvac|directory]\nDefault: fixture only. Live mode performs one anonymous public Search with synthetic data; never Act or provider outreach.");
    return;
  }
  if (args.some((arg) => arg !== "--live-search" && !arg.startsWith("--scenario="))
    || args.filter((arg) => arg.startsWith("--scenario=")).length > 1) {
    throw new DiscoveryError("Unsupported arguments. Use --help; this prototype does not accept customer data or credentials.");
  }
  const scenario = args.find((arg) => arg.startsWith("--scenario="))?.slice("--scenario=".length) ?? "plumber";
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new DiscoveryError("Choose the synthetic plumber, hvac or directory scenario.");
  console.log(JSON.stringify(await runDiscovery({ liveSearch: args.includes("--live-search"), scenario: scenario as Scenario }), null, 2));
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: error instanceof DiscoveryError ? error.message : "Discovery prototype failed; private error details were omitted." }));
  process.exitCode = 1;
});

