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

export const QuoteEvidenceSchema = z.object({
  field: z.enum(["price", "fee", "availability", "scope", "warranty", "conditions", "missingInformation", "photo_review"]),
  providerText: z.string().min(1),
  turnIndex: z.number().int().nonnegative().nullable().optional(),
});

export const RepairBriefSchema = z.object({
  schemaVersion: z.literal(1),
  requestId: z.string().min(1),
  briefVersion: z.string().min(1),
  recommendedPath: z.enum(["professional", "emergency"]),
  requesterRole: z.enum(["homeowner", "property_manager"]),
  referenceAt: z.iso.datetime({ offset: true }),
  observedDescription: z.string().min(1),
  diagnosis: DiagnosisSchema,
  serviceArea: z.object({
    city: z.string().min(1),
    region: z.string().min(1),
    country: z.literal("US"),
    postalCode: z.string().nullable(),
    timeZone: z.string().min(1),
  }),
  photoIds: z.array(z.string()),
  questionsForUser: z.array(z.string()),
}).strict();

export const ProviderTargetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trade: TradeSchema,
  source: z.literal("seeded"),
  serviceAreaMatch: z.boolean(),
  contactVerified: z.boolean(),
}).strict();

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
  quoteBasis: z.enum(["description_only", "inspection_required", "photos_and_call"]).optional(),
  photoReviewState: z.enum(["unknown", "not_reviewed", "reviewed"]).optional(),
});

export const TranscriptTurnSchema = z.object({
  speaker: z.enum(["agent", "user", "transfer_target"]),
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
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

export const CallSourceSchema = z.object({
  dialCallId: z.string().min(1),
  direction: z.literal("outbound"),
  terminationType: z.string().nullable(),
  transcript: z.string().min(1),
  turns: z.array(TranscriptTurnSchema),
});

export const QuoteResultSchema = z.object({
  requestId: z.string().min(1),
  briefVersion: z.string().min(1),
  providerId: z.string().min(1),
  dialCallId: z.string().min(1),
  extractionMethod: z.enum(["model", "deterministic_mock", "assistant_review", "human_review"]),
  outcome: z.enum(["quote_received", "inspection_only", "needs_information", "declined"]),
  collectionStatus: z.enum(["complete", "partial"]),
  uncollectedFields: z.array(z.enum(["repair_price", "fee", "fee_treatment", "scope", "availability", "warranty", "conditions"])),
  quote: QuoteSchema.extend({ pricingType: z.enum(["flat", "hourly", "inspection_only", "unknown"]) }),
  feeTreatment: z.enum(["none", "additional", "included", "waived_if_hired", "unknown"]),
  missingInformation: z.array(z.string()),
  quoteBasis: z.enum(["description_only", "inspection_required", "photos_and_call"]),
  photoReviewState: z.enum(["unknown", "not_reviewed", "reviewed"]),
  evidence: z.array(QuoteEvidenceSchema.extend({
    turnIndex: z.number().int().nonnegative(),
    providerText: z.string().default(""),
  })).min(1),
}).strict();

export const BookingResultSchema = z.object({
  confirmed: z.boolean(),
  slot: z.string().nullable(),
  notes: z.string(),
  outcome: z.enum(["confirmed", "no_matching_window", "revised_terms", "needs_information", "declined"]).optional(),
  termsUnchanged: z.boolean().optional(),
  evidence: z.array(z.object({
    field: z.enum(["slot", "terms", "outcome"]),
    turnIndex: z.number().int().nonnegative(),
    providerText: z.string().default(""),
  })).optional(),
});
