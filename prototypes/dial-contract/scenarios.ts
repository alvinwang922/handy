import type { ProviderTarget, RepairBrief } from "./contract";

export const brief: RepairBrief = {
  schemaVersion: 1,
  requestId: "req_contract_sink_demo",
  briefVersion: "brief_1",
  recommendedPath: "professional",
  requesterRole: "homeowner",
  referenceAt: "2026-10-11T14:00:00-07:00",
  observedDescription: "Slow drip at the kitchen sink drain connection after running the faucet. Cabinet floor becomes damp. No active flooding. Pipe material and diameter are unknown.",
  diagnosis: {
    title: "Possible sink drain connection leak",
    likelyCause: "Loose slip nut or worn washer; not confirmed",
    trade: "plumber",
    urgency: "soon",
    needsOnsiteInspection: true,
    costRangeUsd: [150, 350],
    jobBrief: "Inspect the kitchen sink drain connection, determine the leak source, and estimate a standard fitting or seal repair. Do not assume the supply line is the source.",
    questionsForProviders: ["Do you carry common sink drain fittings?", "What details would change your estimate?"],
    confidence: 0.72,
  },
  serviceArea: { city: "San Francisco", region: "CA", country: "US", postalCode: "94110", timeZone: "America/Los_Angeles" },
  photoIds: [],
  questionsForUser: [],
};

const common = [
  "You are the AI receptionist of a FICTIONAL plumbing business in an authorized Handy prototype. Answer as the provider, not as Handy's caller. Briefly disclose you are an AI receptionist. Be concise and cooperative.",
  "The caller is another AI collecting a quote for a hypothetical kitchen sink drain leak in San Francisco. This is not an actual customer job. You serve that area. You carry standard sink drain fittings.",
  "The date is October 11, 2026. All openings are in America/Los_Angeles (Pacific daylight time). Give explicit calendar dates, not relative weekdays alone.",
  "You have not received or examined any photos. Never claim otherwise. You can discuss descriptions. Do not create appointments or request an exact address or payment; this is quote collection only.",
  "Give the terms below naturally when asked. Ask only one relevant question. If the caller does not know an answer, accept that and state the condition. Do not get stuck demanding missing information. Confirm a correct readback, say goodbye, and end the call.",
].join("\n");

export const scenarios: Array<{ id: string; provider: ProviderTarget; inboundInstruction: string }> = [
  {
    id: "fixed",
    provider: { id: "demo_fixed", name: "Handy Demo Plumbing A", trade: "plumber", source: "controlled_demo", serviceAreaMatch: true, contactVerified: true, numberRole: "provider" },
    inboundInstruction: `${common}\nYou represent Handy Demo Plumbing A. Quote USD 220 flat for resealing or replacing a standard drain fitting, including labor and standard parts. No visit fee. This is a description-based estimate, subject to confirmation on arrival; hidden corrosion or nonstandard pipe needs a new approval. Openings: October 13, 2026, 9–11 AM Pacific, or October 14, 2026, 1–3 PM Pacific. Workmanship warranty: 90 days. Ask whether the drip happens only when water runs; the brief says yes.`,
  },
  {
    id: "range_fee",
    provider: { id: "demo_range", name: "Handy Demo Plumbing B", trade: "plumber", source: "controlled_demo", serviceAreaMatch: true, contactVerified: true, numberRole: "provider" },
    inboundInstruction: `${common}\nYou represent Handy Demo Plumbing B. Estimate USD 180 to 280 for a standard sink drain repair, labor and standard parts included, final repair price after inspection. Diagnostic visit fee: USD 89 if the customer declines the repair, waived if they hire you for the repair. Do not add the waived fee to the repair estimate. Openings: October 13, 2026, 2–4 PM Pacific, or October 15, 2026, 9–11 AM Pacific. Workmanship warranty: 30 days. Ask about pipe material; if unknown the range remains provisional.`,
  },
  {
    id: "inspection",
    provider: { id: "demo_inspection", name: "Handy Demo Plumbing C", trade: "plumber", source: "controlled_demo", serviceAreaMatch: true, contactVerified: true, numberRole: "provider" },
    inboundInstruction: `${common}\nYou represent Handy Demo Plumbing C. Do not quote any repair total from the description. Offer only a USD 75 inspection visit; this fee is additional to any separately approved repair. Need a close-up photo and pipe diameter to consider a remote repair estimate, and those are currently unknown. Openings for inspection: October 14, 2026, 10 AM–noon Pacific, or October 16, 2026, 1–3 PM Pacific. Parts, labor price, and repair warranty cannot be confirmed until diagnosis on site. Clearly distinguish the inspection fee from a repair price.`,
  },
];
