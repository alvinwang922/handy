import { config } from "./config";
import type { BookingResult, Diagnosis, Quote, Trade, UnitInsight } from "./types";

// Owner: P2. Real implementations: use @anthropic-ai/sdk (read the `claude-api` skill first),
// send the photo as an image block, and validate every result with lib/schemas.ts before returning.
export const MODEL_DIAGNOSE = "claude-opus-5-5";
export const MODEL_EXTRACT = "claude-sonnet-5-5";

export async function diagnose(input: {
  photo: Buffer | null;
  mediaType: string;
  description: string;
  unitInsight: UnitInsight | null;
}): Promise<Diagnosis> {
  if (config.mockClaude) return mockDiagnose(input.description);
  throw new Error("TODO(P2): diagnose() — Claude vision + DiagnosisSchema. Set MOCK_CLAUDE=1 meanwhile.");
}

export async function extractQuote(input: { transcript: string; diagnosis: Diagnosis }): Promise<Quote> {
  if (config.mockClaude) return mockExtractQuote(input.transcript);
  throw new Error("TODO(P2): extractQuote() — transcript → QuoteSchema. Set MOCK_CLAUDE=1 meanwhile.");
}

export async function extractBooking(input: { transcript: string; offeredSlots: string[] }): Promise<BookingResult> {
  if (config.mockClaude) return { confirmed: true, slot: input.offeredSlots[0] ?? null, notes: "Mock: provider accepted the first window." };
  throw new Error("TODO(P2): extractBooking() — transcript → BookingResultSchema. Set MOCK_CLAUDE=1 meanwhile.");
}

// ---- Mocks (keyword heuristics, good enough to drive the UI) -----------------------------

function mockDiagnose(description: string): Diagnosis {
  const t = description.toLowerCase();
  const trade: Trade = /gas|spark|smoke|outlet|breaker|light/.test(t)
    ? "electrician"
    : /leak|drip|pipe|sink|toilet|faucet|drain|water heater/.test(t)
      ? "plumber"
      : /\bac\b|air|cool|heat|furnace|hvac/.test(t)
        ? "hvac"
        : /fridge|washer|dryer|dishwasher|oven/.test(t)
          ? "appliance"
          : "handyman";
  const emergency = /gas smell|smell gas|sparks|smoke|flood/.test(t);
  return {
    title: trade === "plumber" ? "Leak at the sink drain connection" : `Likely ${trade} issue`,
    likelyCause: trade === "plumber" ? "Loose slip nut or worn washer on the P-trap" : "Needs a closer look by a pro",
    trade,
    urgency: emergency ? "emergency" : "soon",
    needsOnsiteInspection: trade !== "plumber",
    costRangeUsd: trade === "plumber" ? [150, 300] : [100, 400],
    jobBrief:
      trade === "plumber"
        ? "A slow leak under a kitchen sink where the drain pipe connects; the cabinet floor gets damp after running the faucet. Likely a loose slip nut or worn washer on the P-trap."
        : `A ${trade} repair at a residential rental: ${description.slice(0, 160)}`,
    questionsForProviders: trade === "plumber" ? ["Do you carry common P-trap parts on the truck?"] : [],
    confidence: 0.72,
  };
}

function mockExtractQuote(transcript: string): Quote {
  const providerLines = transcript
    .split("\n")
    .filter((l) => !/^agent:/i.test(l.trim()))
    .join("\n");
  const amounts = [...providerLines.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const fee = providerLines.match(/\$(\d+)[^.\n]{0,40}(fee|diagnostic|visit)/i);
  const visitFeeUsd = fee ? Number(fee[1]) : null;
  const prices = amounts.filter((a) => a !== visitFeeUsd);
  const windows = [...providerLines.matchAll(/\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day[^.,;\n]*/gi)]
    .flatMap((m) => m[0].split(/\s+or\s+/))
    .map((w) => w.trim());
  return {
    priceLowUsd: prices.length ? Math.min(...prices) : null,
    priceHighUsd: prices.length ? Math.max(...prices) : null,
    pricingType: /hour/i.test(providerLines) ? "hourly" : visitFeeUsd != null ? "visit_fee_plus" : "flat",
    visitFeeUsd,
    availability: windows.slice(0, 2),
    needsInspection: /inspect|take a look first/i.test(providerLines),
    scope: null,
    warranty: null,
    conditions: null,
    notes: "Mock extraction (regex) — real extraction comes from Claude.",
    confidence: prices.length ? 0.8 : 0.3,
  };
}
