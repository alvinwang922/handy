import { afterEach, describe, expect, it, vi } from "vitest";
import { imageBlockFor, toDiagnosis, type DiagnosisModelOutput } from "../lib/claude";
import { DiagnosisSchema } from "../lib/schemas";

const wire: DiagnosisModelOutput = {
  title: "Running toilet",
  summary: "The flapper is warped, so water keeps leaking into the bowl. Replacing the flapper should stop it.",
  likelyCause: "Worn flapper valve",
  visibleEvidence: ["Warped rubber flapper at the bottom of the tank"],
  trade: "plumber",
  urgency: "routine",
  safetyGuidance: null,
  needsOnsiteInspection: false,
  costLowUsd: 120,
  costHighUsd: 220,
  proposedScope: "Replace the flapper and adjust the fill valve.",
  jobBrief: "A toilet keeps running after flushing. The flapper looks warped.",
  questionsForProviders: ["Do you carry universal flappers?"],
  confidence: 0.85,
  fixPath: "diy",
  diyPlan: {
    parts: [{ name: "Universal 2 in. toilet flapper", approxPriceUsd: 9, compatibility: "Check the flush valve opening: 2 in. or 3 in." }],
    tools: ["None"],
    steps: ["Shut the supply valve", "Flush to empty the tank", "Swap the flapper", "Turn water back on"],
    minutes: 15,
    stopIf: "Call a plumber if the tank or the flush valve seat is cracked.",
  },
  openQuestions: ["Is the flush valve opening 2 in. or 3 in.?"],
};
const ctx = { photoAnalyzed: true };

describe("imageBlockFor", () => {
  it("sends JPEG as a base64 image block", () => {
    const block = imageBlockFor(Buffer.from("jpeg-bytes"), "image/jpeg");
    expect(block).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: Buffer.from("jpeg-bytes").toString("base64") },
    });
  });

  it("skips formats Claude can't read, oversized files and missing photos", () => {
    expect(imageBlockFor(Buffer.from("x"), "image/heic")).toBeNull();
    expect(imageBlockFor(Buffer.alloc(4_000_000), "image/png")).toBeNull();
    expect(imageBlockFor(null, "image/jpeg")).toBeNull();
  });
});

describe("toDiagnosis", () => {
  it("maps the model output onto the Diagnosis contract", () => {
    const d = toDiagnosis(wire, ctx);
    expect(DiagnosisSchema.safeParse(d).success).toBe(true);
    expect(d).toMatchObject({ costRangeUsd: [120, 220], source: "claude", photoAnalyzed: true, fixPath: "diy" });
    expect(d.diyPlan?.parts[0].compatibility).toContain("2 in.");
    expect(d.openQuestions).toHaveLength(1);
  });

  it("sorts a reversed cost range and clamps confidence", () => {
    const d = toDiagnosis({ ...wire, costLowUsd: 300, costHighUsd: 149.6, confidence: 1.4 }, ctx);
    expect(d.costRangeUsd).toEqual([150, 300]);
    expect(d.confidence).toBe(1);
  });

  it("drops photo evidence when no photo was analyzed", () => {
    expect(toDiagnosis(wire, { photoAnalyzed: false }).visibleEvidence).toEqual([]);
  });

  it("fills default safety guidance for an emergency the model left blank", () => {
    const d = toDiagnosis({ ...wire, urgency: "emergency", safetyGuidance: "  " }, ctx);
    expect(d.safetyGuidance).toMatch(/911/);
  });

  it.each([
    ["an emergency", { urgency: "emergency" as const }],
    ["low confidence", { confidence: 0.5 }],
    ["electrical work", { trade: "electrician" as const }],
    ["an empty parts list", { diyPlan: { ...wire.diyPlan!, parts: [] } }],
    ["a missing plan", { diyPlan: null }],
  ])("turns a DIY suggestion into pro for %s", (_label, patch) => {
    const d = toDiagnosis({ ...wire, ...patch }, ctx);
    expect(d.fixPath).toBe("pro");
    expect(d.diyPlan).toBeNull();
  });
});

describe("mock diagnose", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function mockDiagnose(description: string) {
    vi.stubEnv("MOCK_CLAUDE", "1");
    vi.resetModules(); // config is read at import time; the static import above loaded it unmocked
    const claude = await import("../lib/claude");
    return claude.diagnose({ photo: null, mediaType: "image/jpeg", description, unitInsight: null });
  }

  it("sends the sink-leak demo to professionals", async () => {
    const d = await mockDiagnose("Leak under the kitchen sink. Slow drip where the drain pipe connects.");
    expect(DiagnosisSchema.safeParse(d).success).toBe(true);
    expect(d).toMatchObject({ trade: "plumber", source: "mock", fixPath: "pro", diyPlan: null });
  });

  it("offers DIY for the cabinet-knob demo", async () => {
    const d = await mockDiagnose("Broken cabinet knob. The kitchen cabinet knob snapped off.");
    expect(DiagnosisSchema.safeParse(d).success).toBe(true);
    expect(d).toMatchObject({ trade: "handyman", source: "mock", fixPath: "diy" });
    expect(d.diyPlan?.tools).toContain("Phillips screwdriver");
  });
});
