// Shared contracts — see docs/superpowers/specs/2026-10-11-handled-design.md §5.
// Change these only with a heads-up to the team: every module codes against them.

export type Trade = "plumber" | "electrician" | "handyman" | "hvac" | "appliance" | "locksmith" | "other";

export interface Property {
  id: string;            // matches the prototype UI ids: p1, p2, p3
  name: string;
  address: string;
  units: string[];
  tenant?: string;
}

export interface Provider {
  id: string;
  name: string;
  trade: Trade;
  phone: string;         // E.164 — real numbers come from data/providers.local.json (gitignored)
  rating: number;
  reviewCount: number;
  serviceArea: string;
  contactVerified?: boolean; // true only for a server-side local override; mocks are trusted separately
}

export interface Diagnosis {
  title: string;
  likelyCause: string;
  trade: Trade;
  urgency: "emergency" | "soon" | "routine";
  needsOnsiteInspection: boolean;
  costRangeUsd: [number, number];
  jobBrief: string;                // 2–3 sentences the voice agent reads to providers
  questionsForProviders: string[];
  confidence: number;              // 0–1
  // Optional additions (diagnosis agent): older literals without them stay valid.
  summary?: string | null;         // plain-language "what's wrong and what needs fixing" for the user
  proposedScope?: string | null;   // what the repair likely involves (PRD §6 "proposed scope")
  safetyGuidance?: string | null;  // what to do right now; always set when urgency = "emergency"
  visibleEvidence?: string[];      // what Claude saw in the photo (empty when no photo was analyzed)
  photoAnalyzed?: boolean;         // false → assessment is based on the description only
  source?: "claude" | "mock";      // label mock assessments in the UI
  fixPath?: "diy" | "pro";         // diy = low-risk part swap a non-expert can do with basic tools
  diyPlan?: DiyPlan | null;        // set only when fixPath = "diy"
  openQuestions?: string[];        // what the user should answer/measure to confirm the issue or part (PRD §6)
}

export interface DiyPlan {
  parts: {
    name: string;
    approxPriceUsd: number | null;
    compatibility: string;         // what to check so the part fits — unverified until the user confirms
  }[];
  tools: string[];
  steps: string[];                 // general steps; the part's own instructions take precedence
  minutes: number | null;
  stopIf: string;                  // when to stop and call a pro instead
}

// Part-search agent (lib/parts.ts): the best purchase options for diyPlan.parts[0]. Search only, never an order.
export interface PartOption {
  rank: number;                    // 1..3
  label: string;                   // "Best match" | "Lowest price" | "Fastest to get"
  partName: string;                // which diyPlan part this answers
  product: string;                 // exact listing title incl. size/variant
  brand: string | null;
  seller: string;                  // e.g. "Home Depot"
  url: string;                     // product page; verified to appear in the agent's search results
  priceUsd: number | null;         // as shown by the seller; null → "Check price at seller"
  delivery: string | null;         // e.g. "Pickup today", "Ships in 2 days"
  returnPolicy: string | null;
  rating: number | null;           // 0–5
  reviewCount: number | null;
  fitNote: string;                 // why it should fit + what the user must still check (never "confirmed")
}

export interface PartSearch {
  status: "searching" | "ready" | "failed";
  partName: string;
  options: PartOption[];           // 0–3, ranked
  searchedAt: string | null;
  source: "claude" | "mock";       // label mock results in the UI
  error: string | null;
}

export interface UnitInsight {
  priorIssuesSameTrade180d: number;
  recommendReplaceQuote: boolean;
  note: string;
}

export interface ProviderScore {
  providerId: string;
  score: number;                   // 0–100
  answerRate: number;              // 0–1
  onTimeRate: number;              // 0–1
  quoteAccuracyPct: number;        // final ÷ quote × 100
  reason: string;
}

// Call-result contract additions (eng-design/dial-call-results-contract.md, validated on 3 live calls).
// All optional, so existing producers and consumers keep working. null = unknown; 0 = explicitly free.
export type QuoteOutcome = "quote_received" | "inspection_only" | "needs_information" | "declined";
export type FeeTreatment = "none" | "additional" | "included" | "waived_if_hired" | "unknown";
export type QuoteField = "repair_price" | "fee" | "fee_treatment" | "scope" | "availability" | "warranty" | "conditions";

export interface QuoteEvidence {
  field: QuoteEvidenceField;
  providerText: string;            // provider's words; matched against provider turns after normalization
  turnIndex?: number | null;       // index into CallRecord.transcriptTurns when known
}

export interface Quote {
  priceLowUsd: number | null;      // repair price only; null for inspection-only offers
  priceHighUsd: number | null;
  // "visit_fee_plus" is legacy: new extractions describe the repair price here and the fee in feeTreatment.
  pricingType: "flat" | "hourly" | "inspection_only" | "visit_fee_plus" | "unknown";
  visitFeeUsd: number | null;
  availability: string[];
  needsInspection: boolean;        // true → label the estimate "provisional" (PRD §6)
  scope: string | null;            // what they said the work includes
  warranty: string | null;
  conditions: string | null;       // e.g. "price confirmed on site", "parts extra"
  notes: string;
  confidence: number;              // < 0.5 → UI shows "unclear — view transcript"
  outcome?: QuoteOutcome;          // business result; a "completed" call is not proof of a quote
  collectionStatus?: "complete" | "partial";
  uncollectedFields?: QuoteField[]; // what OUR agent failed to establish (e.g. availability)
  missingInformation?: string[];   // what the PROVIDER asked for (e.g. pipe material, close-up photo)
  feeTreatment?: FeeTreatment;     // "waived_if_hired" is not an extra charge
  evidence?: QuoteEvidence[];
  quoteBasis?: "description_only" | "inspection_required" | "photos_and_call";
  photoReviewState?: PhotoReviewState;
}

export type TranscriptSpeaker = "agent" | "user" | "transfer_target";

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
  startMs: number;
  endMs: number;
}

export type QuoteCollectionField = QuoteField;
export type QuoteEvidenceField = "price" | "fee" | "availability" | "scope" | "warranty" | "conditions" | "missingInformation" | "photo_review";
export type PhotoReviewState = "unknown" | "not_reviewed" | "reviewed";

export interface ReferencedQuoteEvidence extends QuoteEvidence {
  turnIndex: number;
}

export interface QuoteResult {
  requestId: string;
  briefVersion: string;
  providerId: string;
  dialCallId: string;
  extractionMethod: "model" | "deterministic_mock" | "assistant_review" | "human_review";
  outcome: QuoteOutcome;
  collectionStatus: "complete" | "partial";
  uncollectedFields: QuoteCollectionField[];
  quote: Quote;
  feeTreatment: FeeTreatment;
  missingInformation: string[];
  quoteBasis: "description_only" | "inspection_required" | "photos_and_call";
  photoReviewState: PhotoReviewState;
  evidence: ReferencedQuoteEvidence[];
}

export interface RepairBrief {
  schemaVersion: 1;
  requestId: string;
  briefVersion: string;
  recommendedPath: "professional" | "emergency";
  requesterRole: "homeowner" | "property_manager";
  referenceAt: string;
  observedDescription: string;
  diagnosis: Diagnosis;
  serviceArea: { city: string; region: string; country: "US"; postalCode: string | null; timeZone: string };
  photoIds: string[];
  questionsForUser: string[];
}

export interface ProviderTarget {
  id: string;
  name: string;
  trade: Trade;
  source: "seeded";
  serviceAreaMatch: boolean;
  contactVerified: boolean;
}

export interface QuoteJob {
  schemaVersion: 1;
  attemptId: string;
  requestId: string;
  briefVersion: string;
  briefHash: string;
  providerId: string;
  purpose: "quote";
  idempotencyKey: string;
  maxCallDurationSeconds: number;
  outboundInstruction: string;
  brief?: RepairBrief;             // snapshot for extraction after the call, even if intake changes
}

// PRD principle 1: no booking call without an explicit, recorded approval.
export interface Approval {
  providerId: string;
  amountUsd: number | null;        // upper bound of the approved repair quote, or the visit fee for inspection-only
  approvedAt: string;
  consentText: string;
  quoteCallId?: string;            // the exact quote call (and its quote) the user approved
  quoteRevision?: string;          // hash of the approved terms and their evidence
  basis?: "repair_quote" | "inspection_visit";
}

export interface BookingResult {
  confirmed: boolean;
  slot: string | null;
  notes: string;
  outcome?: "confirmed" | "no_matching_window" | "revised_terms" | "needs_information" | "declined";
  termsUnchanged?: boolean;
  evidence?: { field: "slot" | "terms" | "outcome"; turnIndex: number; providerText: string }[];
}

export interface BookingJob {
  requestId: string;
  providerId: string;
  quoteCallId: string;
  quoteRevision: string;
  approvedQuote: Quote;
  feeTreatment: FeeTreatment;
  approvalAmountUsd: number | null;
  approvalBasis: "repair_quote" | "inspection_visit";
  offeredSlots: string[];
  timeZone: string;
  referenceAt: string;
}

export interface BookingExtractionInput extends BookingJob {
  dialCallId: string;
  transcript: string;
  transcriptTurns: TranscriptTurn[];
}

export type CallPurpose = "quote" | "booking";
export type CallState = "queued_local" | "Queued" | "Ringing" | "In-Progress" | "Terminated";
export type TerminationType = "completed" | "busy" | "no-answer" | "failed" | "canceled";
export type CallDispatchState = "queued" | "dispatching" | "accepted" | "send_unknown" | "failed";
export type TranscriptStatus = "pending" | "ready" | "unavailable";
export type ExtractionStatus = "not_started" | "pending" | "validated" | "failed";

export interface CallRecord {
  id: string;
  dialCallId: string | null;
  providerId: string;
  purpose: CallPurpose;
  dispatchState: CallDispatchState;
  idempotencyKey: string;
  outboundInstruction: string;
  quoteJob: QuoteJob | null;
  state: CallState;
  terminationType: TerminationType | null;
  durationSec: number | null;
  transcript: string | null;
  transcriptStatus: TranscriptStatus;
  transcriptTurns: TranscriptTurn[];
  transcriptHash: string | null;
  quote: Quote | null;
  quoteResult: QuoteResult | null;
  quoteRevision?: string | null;   // hash of terms + evidence, submitted with booking approval
  booking: BookingResult | null;
  bookingJob?: BookingJob | null; // freezes approved terms and user windows before dispatch
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;            // last placement error (e.g. Dial 402/429), shown in UI
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  extractAttempts: number;         // transcript → quote/booking extraction tries (capped at 3)
}

export type RequestStatus =
  | "diagnosed" | "emergency" | "quoting" | "quotes_ready" | "booking" | "scheduled" | "failed";

export interface RepairRequest {
  id: string;
  title: string;                   // user-entered title
  description: string;
  requesterRole: "homeowner" | "property_manager";
  propertyId: string;
  unit: string;
  room: string;
  photoPath: string | null;        // data/uploads/<id>.<ext>; served at /api/requests/[id]/photo
  status: RequestStatus;
  diagnosis: Diagnosis | null;
  unitInsight: UnitInsight | null;
  rankedProviders: ProviderScore[];
  calls: CallRecord[];
  selectedProviderId: string | null;
  offeredSlots: string[];
  accessNote: string;
  approval: Approval | null;
  scheduledSlot: string | null;
  notice: string | null;           // banner text (e.g. "Dial credit exhausted")
  timeline: { status: RequestStatus; at: string }[];
  userActiveSec: number;           // client-measured: form time + review/approve time
  createdAt: string;
  partSearch?: PartSearch | null;  // set for DIY diagnoses; filled in the background by lib/parts.ts
}
