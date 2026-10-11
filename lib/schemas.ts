import { z } from "zod";

// zod mirrors of lib/types.ts — validate every JSON object Claude returns before trusting it.

export const TradeSchema = z.enum(["plumber", "electrician", "handyman", "hvac", "appliance", "locksmith", "other"]);

export const DiyPlanSchema = z.object({
  parts: z.array(z.object({ name: z.string(), approxPriceUsd: z.number().nullable(), compatibility: z.string() })),
  tools: z.array(z.string()),
  steps: z.array(z.string()),
  minutes: z.number().nullable(),
  stopIf: z.string(),
});

export const DiagnosisSchema = z.object({
  title: z.string(),
  likelyCause: z.string(),
  trade: TradeSchema,
  urgency: z.enum(["emergency", "soon", "routine"]),
  needsOnsiteInspection: z.boolean(),
  costRangeUsd: z.tuple([z.number(), z.number()]),
  jobBrief: z.string(),
  questionsForProviders: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  summary: z.string().nullable().optional(),
  proposedScope: z.string().nullable().optional(),
  safetyGuidance: z.string().nullable().optional(),
  visibleEvidence: z.array(z.string()).optional(),
  photoAnalyzed: z.boolean().optional(),
  source: z.enum(["claude", "mock"]).optional(),
  fixPath: z.enum(["diy", "pro"]).optional(),
  diyPlan: DiyPlanSchema.nullable().optional(),
  openQuestions: z.array(z.string()).optional(),
});

export const QuoteSchema = z.object({
  priceLowUsd: z.number().nullable(),
  priceHighUsd: z.number().nullable(),
  pricingType: z.enum(["flat", "hourly", "visit_fee_plus", "unknown"]),
  visitFeeUsd: z.number().nullable(),
  availability: z.array(z.string()),
  needsInspection: z.boolean(),
  scope: z.string().nullable(),
  warranty: z.string().nullable(),
  conditions: z.string().nullable(),
  notes: z.string(),
  confidence: z.number().min(0).max(1),
});

export const PartOptionSchema = z.object({
  rank: z.number().int().min(1).max(3),
  label: z.string(),
  partName: z.string(),
  product: z.string(),
  brand: z.string().nullable(),
  seller: z.string(),
  url: z.url({ protocol: /^https$/ }),
  priceUsd: z.number().positive().nullable(),
  delivery: z.string().nullable(),
  returnPolicy: z.string().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  fitNote: z.string(),
});

export const PartSearchSchema = z.object({
  status: z.enum(["searching", "ready", "failed"]),
  partName: z.string(),
  options: z.array(PartOptionSchema).max(3),
  searchedAt: z.string().nullable(),
  source: z.enum(["claude", "mock"]),
  error: z.string().nullable(),
});

export const BookingResultSchema = z.object({
  confirmed: z.boolean(),
  slot: z.string().nullable(),
  notes: z.string(),
});
