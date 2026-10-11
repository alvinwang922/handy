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
  field: "price" | "fee" | "availability" | "scope" | "warranty" | "conditions" | "missingInformation";
  providerText: string;            // provider's words; matched against provider turns after normalization
  turnIndex?: number | null;       // index into CallRecord.transcriptTurns when known
}

export interface TranscriptTurn {
  speaker: "agent" | "user" | "transfer_target"; // on an outbound call, "user" is the provider
  text: string;
  startMs: number;
  endMs: number;
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
}

// PRD principle 1: no booking call without an explicit, recorded approval.
export interface Approval {
  providerId: string;
  amountUsd: number | null;        // upper bound of the approved repair quote, or the visit fee for inspection-only
  approvedAt: string;
  consentText: string;
  quoteCallId?: string;            // the exact quote call (and its quote) the user approved
  basis?: "repair_quote" | "inspection_visit";
}

export interface BookingResult {
  confirmed: boolean;
  slot: string | null;
  notes: string;
}

export type CallPurpose = "quote" | "booking";
export type CallState = "queued_local" | "Queued" | "Ringing" | "In-Progress" | "Terminated";
export type TerminationType = "completed" | "busy" | "no-answer" | "failed" | "canceled";

export interface CallRecord {
  id: string;
  dialCallId: string | null;
  providerId: string;
  purpose: CallPurpose;
  state: CallState;
  terminationType: TerminationType | null;
  durationSec: number | null;
  transcript: string | null;
  transcriptTurns?: TranscriptTurn[] | null; // speaker-separated; needed for evidence checks and talk-time metrics
  quote: Quote | null;
  booking: BookingResult | null;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;            // last placement error (e.g. Dial 402/429), shown in UI
  extractAttempts?: number;        // transcript → quote/booking extraction tries (capped at 3)
}

export type RequestStatus =
  | "diagnosed" | "emergency" | "quoting" | "quotes_ready" | "booking" | "scheduled" | "failed";

export interface RepairRequest {
  id: string;
  title: string;                   // user-entered title
  description: string;
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
}
