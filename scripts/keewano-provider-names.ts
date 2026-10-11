// Owner: P4. Labels every provider entity with its display name so live SQL / MCP questions
// ("which plumber answers the most calls?") return names instead of UUIDs. Safe to re-run.
// The event is backdated to before the seeded history (which starts 60 days ago), so the name
// holds forward over every event when Keewano orders a timeline by timestamp.
// Run: npx tsx --env-file=.env.local scripts/keewano-provider-names.ts
import { sendEvents } from "../lib/keewano";
import { listProviders } from "../lib/store";

const BEFORE_SEED = Math.floor(Date.now() / 1000) - 61 * 86_400;

async function main() {
  const providers = listProviders();
  const results = await Promise.allSettled(
    providers.map((p) => sendEvents({ kind: "provider", id: p.id }, [{ name: "ProviderName", value: p.name, timestamp: BEFORE_SEED }])),
  );
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) console.error("failed:", ((f as PromiseRejectedResult).reason as Error).message);
  console.log(`ProviderName sent for ${providers.length - failed.length}/${providers.length} providers. Queryable in ~5 minutes.`);
  if (failed.length) process.exit(1);
}

main();
