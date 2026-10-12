// Pre-demo readiness check. Run: npm run preflight [-- --trade=plumber]
// Prints PASS/WARN/FAIL lines only: never a key value or a phone number. Places no calls.
import { MODEL_DIAGNOSE, MODEL_EXTRACT } from "../lib/claude";
import { config } from "../lib/config";
import { rankForRequest } from "../lib/orchestrator";
import { type Check, configChecks, maskPhones, providerCheck, summarize } from "../lib/preflight";
import { getProvider, listProviders } from "../lib/store";
import type { RepairRequest, Trade } from "../lib/types";

const trade = (process.argv.find((a) => a.startsWith("--trade="))?.split("=")[1] ?? "plumber") as Trade;
const DIAL = "https://api.getdial.ai/api/v1";
const has = (name: string) => Boolean(process.env[name]);
const fail = (name: string, e: unknown): Check => ({ name, status: "fail", detail: (e as Error).message });

async function dialNumber(id: string): Promise<{ number: string; callingEnabled: boolean; inboundInstruction: string }> {
  const res = await fetch(`${DIAL}/numbers/${id}`, {
    headers: { Authorization: `Bearer ${process.env.DIAL_RECEPTIONIST_API_KEY && id === process.env.DIAL_RECEPTIONIST_NUMBER_ID ? process.env.DIAL_RECEPTIONIST_API_KEY : process.env.DIAL_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Dial GET number: HTTP ${res.status}`);
  const n = (await res.json()).number ?? {};
  return { number: String(n.number ?? ""), callingEnabled: n.callingEnabled === true, inboundInstruction: String(n.inboundInstruction ?? "") };
}

async function main() {
  const checks: Check[] = [...configChecks(config, has), providerCheck(trade, listProviders(), config.mockDial)];

  // Who the app would call right now: the same function outreach uses, on a stand-in request.
  let called: string[] = [];
  try {
    const probe = { diagnosis: { trade }, calls: [], notice: null } as unknown as RepairRequest;
    const t0 = Date.now();
    const { ranked, providers } = await rankForRequest(probe);
    called = providers.map((p) => p.id);
    const name = (id: string) => getProvider(id)?.name ?? id;
    const skipped = ranked.filter((s) => !called.includes(s.providerId));
    const detail =
      `Calls ${providers.map((p) => `${p.name} (${ranked.find((s) => s.providerId === p.id)?.score})`).join(", ") || "nobody"}` +
      (skipped.length ? ` · skips ${skipped.map((s) => `${name(s.providerId)} (${s.score})`).join(", ")}` : "") +
      ` · ${Date.now() - t0} ms`;
    checks.push({
      name: "Keewano ranking",
      status: !providers.length ? "fail" : probe.notice ? "warn" : "pass",
      detail: probe.notice ? `${probe.notice} ${detail}` : config.mockKeewano ? `(mock) ${detail}` : detail,
    });
  } catch (e) {
    checks.push(fail("Keewano ranking", e));
  }

  if (config.mockDial) {
    checks.push({ name: "Dial", status: "pass", detail: "Skipped (MOCK_DIAL=1)" });
  } else {
    try {
      const from = await dialNumber(process.env.DIAL_FROM_NUMBER_ID ?? "");
      checks.push(
        from.callingEnabled
          ? { name: "Dial caller", status: "pass", detail: "Caller number is set up and calling is enabled" }
          : { name: "Dial caller", status: "fail", detail: "Caller number has calling disabled in Dial" },
      );
    } catch (e) {
      checks.push(fail("Dial caller", e));
    }
    const receptionistId = process.env.DIAL_RECEPTIONIST_NUMBER_ID;
    if (receptionistId) {
      try {
        const rec = await dialNumber(receptionistId);
        const persona = rec.inboundInstruction.includes("Bay Area Rooter");
        const callsReceptionist = called.some((id) => getProvider(id)?.phone === rec.number);
        checks.push(
          !callsReceptionist
            ? { name: "Who answers", status: "pass", detail: "A teammate's phone: ringer on, answer on speaker within 2 rings" }
            : persona
              ? { name: "Who answers", status: "pass", detail: "Our AI receptionist, as Bay Area Rooter (persona set)" }
              : { name: "Who answers", status: "fail", detail: "Our AI receptionist, but its persona isn't set: run npm run setup:receptionist" },
        );
      } catch (e) {
        checks.push(fail("Who answers", e));
      }
    }
  }

  if (config.mockClaude && config.mockClaudeExtract) {
    checks.push({ name: "Claude", status: "pass", detail: "Skipped (MOCK_CLAUDE=1)" });
  } else {
    try {
      const models = [...new Set([...(config.mockClaude ? [] : [MODEL_DIAGNOSE]), ...(config.mockClaudeExtract ? [] : [MODEL_EXTRACT])])];
      for (const model of models) {
        const res = await fetch(`https://api.anthropic.com/v1/models/${model}`, {
          headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`${model}: HTTP ${res.status}`);
      }
      checks.push({ name: "Claude", status: "pass", detail: `Key works; ${models.join(" and ")} available` });
    } catch (e) {
      checks.push(fail("Claude", e));
    }
  }

  try {
    const res = await fetch("http://127.0.0.1:3000/api/providers", { signal: AbortSignal.timeout(3_000) });
    checks.push({ name: "App", status: res.ok ? "pass" : "warn", detail: `http://127.0.0.1:3000 answers (HTTP ${res.status}); restart it if you changed .env.local since starting` });
  } catch {
    checks.push({ name: "App", status: "warn", detail: "Not running: start it with npm run dev" });
  }

  const tag = { pass: "PASS", warn: "WARN", fail: "FAIL" } as const;
  console.log(`Handy preflight · trade: ${trade}\n`);
  for (const c of checks) console.log(`  ${tag[c.status]}  ${c.name.padEnd(16)} ${maskPhones(c.detail)}`);
  const { ok, line } = summarize(checks);
  console.log(`\n${line}`);
  process.exit(ok ? 0 : 1); // also closes the Keewano connection pool
}

main().catch((e) => {
  console.error(maskPhones(`Preflight crashed: ${(e as Error).message}`));
  process.exit(1);
});
