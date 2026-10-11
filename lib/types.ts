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

export interface Quote {
  priceLowUsd: number | null;
  priceHighUsd: number | null;
  pricingType: "flat" | "hourly" | "visit_fee_plus" | "unknown";
  visitFeeUsd: number | null;
  availability: string[];
  needsInspection: boolean;        // true → label the estimate "provisional" (PRD §6)
  scope: string | null;            // what they said the work includes
  warranty: string | null;
  conditions: string | null;       // e.g. "price confirmed on site", "parts extra"
  notes: string;
  confidence: number;              // < 0.5 → UI shows "unclear — view transcript"
}

// PRD principle 1: no booking call without an explicit, recorded approval.
export interface Approval {
  providerId: string;
  amountUsd: number | null;        // upper bound of the approved quote
  approvedAt: string;
  consentText: string;
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
  partSearch?: PartSearch | null;  // set for DIY diagnoses; filled in the background by lib/parts.ts
}
