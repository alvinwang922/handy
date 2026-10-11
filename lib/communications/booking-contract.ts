import { BookingResultSchema } from "../schemas";
import type { BookingExtractionInput, BookingResult } from "../types";

export function validateBookingResult(raw: unknown, input: BookingExtractionInput, requireEvidence: boolean): BookingResult {
  const result = BookingResultSchema.parse(raw);
  if (result.confirmed) {
    if (!result.slot || !input.offeredSlots.includes(result.slot)) {
      throw new Error("Provider confirmation must identify one of the user's approved windows exactly.");
    }
    if (result.termsUnchanged === false || (result.outcome && result.outcome !== "confirmed")) {
      throw new Error("Changed terms require renewed approval; this booking cannot be confirmed.");
    }
    if (requireEvidence && (result.termsUnchanged !== true
      || !result.evidence?.some((span) => span.field === "slot")
      || !result.evidence?.some((span) => span.field === "terms"))) {
      throw new Error("Live booking requires provider evidence for the chosen window and unchanged approved terms.");
    }
  } else {
    if (result.outcome === "confirmed") {
      throw new Error("An unconfirmed booking cannot declare a confirmed outcome.");
    }
    // A model failing to recognize a booking is different from the provider explicitly declining it.
    // Throwing preserves reconciliation instead of reopening booking and risking another call.
    if (requireEvidence && (!result.outcome || !result.evidence?.some((span) => span.field === "outcome"))) {
      throw new Error("Live negative booking results require an explicit provider outcome and supporting evidence; reconcile ambiguous calls.");
    }
  }
  for (const span of result.evidence ?? []) {
    const turn = input.transcriptTurns[span.turnIndex];
    if (turn?.speaker !== "user" || !turn.text.trim()) {
      throw new Error("Booking evidence must reference the provider's transcript turns.");
    }
  }
  return {
    ...result,
    evidence: result.evidence?.map((span) => ({ ...span, providerText: input.transcriptTurns[span.turnIndex].text })),
  };
}
