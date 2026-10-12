// Pure checks behind `npm run preflight` (scripts/preflight.ts does the network checks).
// Nothing here reads or returns a key value or a phone number.

export type Status = "pass" | "warn" | "fail";
export interface Check {
  name: string;
  status: Status;
  detail: string;
}

export interface PreflightConfig {
  mockDial: boolean;
  mockClaude: boolean;
  mockClaudeExtract: boolean;
  mockParts: boolean;
  mockKeewano: boolean;
  quoteFanout: number;
  maxConcurrentCalls: number;
}

export interface ProviderLike {
  id: string;
  trade: string;
  phone: string;
  contactVerified?: boolean;
}

// Dial's free tier allows 2 concurrent calls (CLAUDE.md rule 5).
const DIAL_FREE_TIER_CONCURRENCY = 2;

export const isE164 = (phone: string) => /^\+1\d{10}$/.test(phone);

// Output goes to terminals that agents may capture: never let a phone number through.
export const maskPhones = (text: string) => text.replace(/(?<![\d+])\+?1?\d{10}(?!\d)/g, "[phone]");

export function configChecks(c: PreflightConfig, has: (envName: string) => boolean): Check[] {
  const mocks = Object.entries({
    MOCK_DIAL: c.mockDial,
    MOCK_CLAUDE: c.mockClaude,
    MOCK_CLAUDE_EXTRACT: c.mockClaudeExtract && !c.mockClaude,
    MOCK_PARTS: c.mockParts && !c.mockClaude,
    MOCK_KEEWANO: c.mockKeewano,
  })
    .filter(([, on]) => on)
    .map(([name]) => name);
  const mode: Check = mocks.length
    ? { name: "Mode", status: "warn", detail: `Simulated parts: ${mocks.join(", ")}. Say so on stage, or set them to 0.` }
    : { name: "Mode", status: "pass", detail: "Live: every MOCK_* flag is off" };

  const f = c.quoteFanout;
  const m = c.maxConcurrentCalls;
  let calls: Check;
  if (!Number.isInteger(f) || f < 1) {
    calls = { name: "Call limits", status: "fail", detail: `QUOTE_FANOUT must be a whole number ≥ 1 (is ${f})` };
  } else if (!c.mockDial && m > DIAL_FREE_TIER_CONCURRENCY) {
    calls = { name: "Call limits", status: "fail", detail: `MAX_CONCURRENT_CALLS=${m}, but Dial's free tier allows ${DIAL_FREE_TIER_CONCURRENCY}` };
  } else if (!c.mockDial && f > 1) {
    calls = { name: "Call limits", status: "warn", detail: `QUOTE_FANOUT=${f}: parallel live calls are untested; the stage demo uses 1` };
  } else {
    calls = { name: "Call limits", status: "pass", detail: `QUOTE_FANOUT=${f}, MAX_CONCURRENT_CALLS=${m}` };
  }

  const required = [
    ...(c.mockClaude && c.mockClaudeExtract ? [] : ["ANTHROPIC_API_KEY"]),
    ...(c.mockDial ? [] : ["DIAL_API_KEY", "DIAL_FROM_NUMBER_ID"]),
    ...(c.mockKeewano ? [] : ["KEEWANO_API_KEY", "KEEWANO_EMAIL", "KEEWANO_PAT", "KEEWANO_PROJECT_ID"]),
  ];
  const missing = required.filter((name) => !has(name));
  const keys: Check = missing.length
    ? { name: "Keys", status: "fail", detail: `Missing in .env.local: ${missing.join(", ")}` }
    : { name: "Keys", status: "pass", detail: required.length ? `All ${required.length} keys for the live parts are set` : "No keys needed in full mock mode" };

  return [mode, calls, keys];
}

export function providerCheck(trade: string, providers: ProviderLike[], mockDial: boolean): Check {
  const name = "Providers";
  if (mockDial) return { name, status: "pass", detail: "MOCK_DIAL=1: calls are simulated, no numbers needed" };
  const verified = providers.filter((p) => p.trade === trade && p.contactVerified);
  if (!verified.length) {
    return { name, status: "fail", detail: `No ${trade} has a number in data/providers.local.json, so outreach has nobody to call` };
  }
  const bad = verified.filter((p) => !isE164(p.phone)).map((p) => p.id);
  if (bad.length) return { name, status: "fail", detail: `Not a +1 E.164 number in data/providers.local.json: ${bad.join(", ")}` };
  return { name, status: "pass", detail: `${verified.length} verified ${trade}: ${verified.map((p) => p.id).join(", ")}` };
}

export function summarize(checks: Check[]): { ok: boolean; line: string } {
  const count = (s: Status) => checks.filter((c) => c.status === s).length;
  const fails = count("fail");
  const warns = count("warn");
  return fails
    ? { ok: false, line: `${fails} FAIL, ${warns} warning(s): fix the FAIL lines before the demo.` }
    : { ok: true, line: warns ? `Ready with ${warns} warning(s): read them before going on stage.` : `All ${checks.length} checks passed. Ready for the demo.` };
}
