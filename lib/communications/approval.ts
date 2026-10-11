import { createHash } from "node:crypto";
import type { CallRecord, RepairRequest } from "../types";

// Include extracted terms as well as source evidence: re-extracting the same transcript
// can change the quote, and therefore must invalidate the previous approval.
export function getQuoteRevision(call: CallRecord): string {
  return createHash("sha256").update(JSON.stringify({
    callId: call.id,
    providerId: call.providerId,
    briefHash: call.quoteJob?.briefHash ?? null,
    transcriptHash: call.transcriptHash,
    quote: call.quote,
    result: call.quoteResult,
  })).digest("hex");
}

export function isActionableQuote(call: CallRecord): boolean {
  if (call.purpose !== "quote" || call.terminationType !== "completed" || !call.quote) return false;
  const outcome = call.quoteResult?.outcome ?? call.quote.outcome;
  if (outcome === "declined" || outcome === "needs_information") return false;
  if (outcome === "inspection_only" || call.quote.pricingType === "inspection_only") {
    return call.quote.visitFeeUsd !== null;
  }
  return call.quote.priceLowUsd !== null || call.quote.priceHighUsd !== null
    || (outcome === undefined && call.quote.visitFeeUsd !== null);
}

export function bookingNeedsReconciliation(request: RepairRequest): boolean {
  return request.calls.some((call) => call.purpose === "booking" && (
    call.dispatchState === "send_unknown"
    || call.dispatchState === "dispatching"
    || (call.terminationType === "completed" && (call.booking === null || call.extractionStatus !== "validated"
      || (call.booking.confirmed && (!call.booking.slot || !request.offeredSlots.includes(call.booking.slot)))))
  ));
}
