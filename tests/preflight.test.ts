import { describe, expect, it } from "vitest";
import { configChecks, maskPhones, providerCheck, summarize, type PreflightConfig } from "../lib/preflight";

const live: PreflightConfig = {
  mockDial: false, mockClaude: false, mockClaudeExtract: false, mockParts: false, mockKeewano: false,
  quoteFanout: 1, maxConcurrentCalls: 2,
};
const allKeys = () => true;
const byName = (checks: ReturnType<typeof configChecks>, name: string) => checks.find((c) => c.name === name)!;

describe("configChecks", () => {
  it("passes the stage configuration", () => {
    expect(configChecks(live, allKeys).map((c) => c.status)).toEqual(["pass", "pass", "pass"]);
  });

  it("warns about simulated parts and names them", () => {
    const mode = byName(configChecks({ ...live, mockKeewano: true }, allKeys), "Mode");
    expect(mode).toMatchObject({ status: "warn" });
    expect(mode.detail).toContain("MOCK_KEEWANO");
  });

  it("fails above Dial's free-tier concurrency and warns on untested parallel calls", () => {
    expect(byName(configChecks({ ...live, maxConcurrentCalls: 3 }, allKeys), "Call limits").status).toBe("fail");
    expect(byName(configChecks({ ...live, quoteFanout: 3 }, allKeys), "Call limits").status).toBe("warn");
    expect(byName(configChecks({ ...live, quoteFanout: 0 }, allKeys), "Call limits").status).toBe("fail");
  });

  it("lists missing keys by name only", () => {
    const keys = byName(configChecks(live, (n) => n !== "KEEWANO_PAT"), "Keys");
    expect(keys).toMatchObject({ status: "fail", detail: "Missing in .env.local: KEEWANO_PAT" });
  });

  it("needs no keys in full mock mode", () => {
    const mock = { ...live, mockDial: true, mockClaude: true, mockClaudeExtract: true, mockParts: true, mockKeewano: true };
    expect(byName(configChecks(mock, () => false), "Keys").status).toBe("pass");
  });
});

describe("providerCheck", () => {
  const p = (id: string, phone: string, contactVerified = true) => ({ id, trade: "plumber", phone, contactVerified });

  it("fails when no provider of the trade has a local number", () => {
    expect(providerCheck("plumber", [p("plumb_rooter", "+14155550101", false)], false).status).toBe("fail");
  });

  it("fails on a malformed number without printing it", () => {
    const check = providerCheck("plumber", [p("plumb_rooter", "4155550101")], false);
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("plumb_rooter");
    expect(check.detail).not.toMatch(/\d{10}/);
  });

  it("passes with verified E.164 numbers", () => {
    expect(providerCheck("plumber", [p("plumb_rooter", "+14155550101"), p("plumb_mission", "+14155550102")], false)).toMatchObject({
      status: "pass",
      detail: "2 verified plumber: plumb_rooter, plumb_mission",
    });
  });
});

describe("maskPhones and summarize", () => {
  it("masks standalone phone numbers but not other long ids", () => {
    expect(maskPhones("call +14155550101 or 4155550101 · id 1791763187634")).toBe("call [phone] or [phone] · id 1791763187634");
  });

  it("is not ok when any check fails", () => {
    expect(summarize([{ name: "a", status: "pass", detail: "" }, { name: "b", status: "fail", detail: "" }]).ok).toBe(false);
    expect(summarize([{ name: "a", status: "warn", detail: "" }]).ok).toBe(true);
  });
});
