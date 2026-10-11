import { z } from "zod";

// zod mirrors of lib/types.ts — validate every JSON object Claude returns before trusting it.

export const TradeSchema = z.enum(["plumber", "electrician", "handyman", "hvac", "appliance", "locksmith", "other"]);

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
});

export const QuoteEvidenceSchema = z.object({
  field: z.enum(["price", "fee", "availability", "scope", "warranty", "conditions", "missingInformation"]),
  providerText: z.string().min(1),
  turnIndex: z.number().int().nonnegative().nullable().optional(),
});

export const QuoteSchema = z.object({
  priceLowUsd: z.number().nonnegative().nullable(),
  priceHighUsd: z.number().nonnegative().nullable(),
  pricingType: z.enum(["flat", "hourly", "inspection_only", "visit_fee_plus", "unknown"]),
  visitFeeUsd: z.number().nonnegative().nullable(),
  availability: z.array(z.string()),
  needsInspection: z.boolean(),
  scope: z.string().nullable(),
  warranty: z.string().nullable(),
  conditions: z.string().nullable(),
  notes: z.string(),
  confidence: z.number().min(0).max(1),
  // Call-result contract additions (optional; see lib/types.ts).
  outcome: z.enum(["quote_received", "inspection_only", "needs_information", "declined"]).optional(),
  collectionStatus: z.enum(["complete", "partial"]).optional(),
  uncollectedFields: z
    .array(z.enum(["repair_price", "fee", "fee_treatment", "scope", "availability", "warranty", "conditions"]))
    .optional(),
  missingInformation: z.array(z.string()).optional(),
  feeTreatment: z.enum(["none", "additional", "included", "waived_if_hired", "unknown"]).optional(),
  evidence: z.array(QuoteEvidenceSchema).optional(),
});

export const TranscriptTurnSchema = z.object({
  speaker: z.enum(["agent", "user", "transfer_target"]),
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

export const BookingResultSchema = z.object({
  confirmed: z.boolean(),
  slot: z.string().nullable(),
  notes: z.string(),
});
