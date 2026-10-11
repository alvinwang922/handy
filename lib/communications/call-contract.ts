import crypto from "node:crypto";
import { config } from "../config";
import { quoteInstruction } from "../instructions";
import { CallSourceSchema, ProviderTargetSchema, QuoteResultSchema, RepairBriefSchema } from "../schemas";
import type { Provider, ProviderTarget, QuoteJob, QuoteResult, RepairBrief, RepairRequest } from "../types";
import { buildRepairPacket } from "./packet";

export function buildRepairBrief(request: RepairRequest): RepairBrief {
  if (!request.diagnosis) throw new Error("A diagnosis is required before provider outreach.");
  const packet = buildRepairPacket(request);
  return RepairBriefSchema.parse({
    schemaVersion: 1,
    requestId: request.id,
    briefVersion: packet.packetVersion,
    recommendedPath: request.diagnosis.urgency === "emergency" ? "emergency" : "professional",
    requesterRole: request.requesterRole,
    referenceAt: request.createdAt,
    observedDescription: [request.title, request.room && `Room: ${request.room}`, request.description].filter(Boolean).join(". "),
    diagnosis: request.diagnosis,
    serviceArea: {
      city: config.serviceAreaCity,
      region: config.serviceAreaRegion,
      country: "US",
      postalCode: null,
      timeZone: config.propertyTimeZone,
    },
    photoIds: packet.photos.map((photo) => photo.id),
    questionsForUser: [],
  });
}

export function buildProviderTarget(provider: Provider): ProviderTarget {
  const serviceAreaMatch = provider.serviceArea.toLowerCase().includes(config.serviceAreaCity.toLowerCase());
  return ProviderTargetSchema.parse({
    id: provider.id,
    name: provider.name,
    trade: provider.trade,
    source: "seeded",
    serviceAreaMatch,
    contactVerified: config.mockDial || provider.contactVerified === true,
  });
}

export function validateQuoteHandoff(brief: RepairBrief, provider: ProviderTarget) {
  const parsedBrief = RepairBriefSchema.parse(brief);
  const parsedProvider = ProviderTargetSchema.parse(provider);
  if (parsedBrief.recommendedPath !== "professional" || parsedBrief.diagnosis.urgency === "emergency") {
    throw new Error("This repair is not eligible for routine outreach.");
  }
  if (parsedBrief.questionsForUser.length) throw new Error("Resolve required user questions before outreach.");
  if (parsedBrief.diagnosis.trade !== parsedProvider.trade) throw new Error("Provider trade does not match the repair.");
  if (!parsedProvider.contactVerified || !parsedProvider.serviceAreaMatch) {
    throw new Error("Verify provider contact and service area before calling.");
  }
  return { brief: parsedBrief, provider: parsedProvider };
}

export function buildQuoteJob(request: RepairRequest, providerRecord: Provider, attemptId: string): QuoteJob {
  const brief = buildRepairBrief(request);
  const provider = buildProviderTarget(providerRecord);
  validateQuoteHandoff(brief, provider);
  const snapshot = JSON.stringify({ brief, provider, purpose: "quote" });
  const outboundInstruction = quoteInstruction(providerRecord, brief.diagnosis, request.unitInsight, config.companyName, {
    requesterRole: brief.requesterRole,
    referenceAt: brief.referenceAt,
    observedDescription: brief.observedDescription,
    serviceArea: `${brief.serviceArea.city}, ${brief.serviceArea.region}`,
    timeZone: brief.serviceArea.timeZone,
    photosAvailable: brief.photoIds.length > 0,
  });
  return {
    schemaVersion: 1,
    attemptId,
    requestId: brief.requestId,
    briefVersion: brief.briefVersion,
    briefHash: crypto.createHash("sha256").update(snapshot).digest("hex"),
    providerId: provider.id,
    purpose: "quote",
    idempotencyKey: `handy:quote:${attemptId}`,
    maxCallDurationSeconds: config.quoteCallMaxSec,
    outboundInstruction,
    brief,
  };
}

export function validateQuoteResult(raw: unknown, job: Pick<QuoteJob, "requestId" | "briefVersion" | "providerId">, rawSource: unknown): QuoteResult {
  const result = QuoteResultSchema.parse(raw);
  const source = CallSourceSchema.parse(rawSource);
  if (
    result.requestId !== job.requestId ||
    result.briefVersion !== job.briefVersion ||
    result.providerId !== job.providerId ||
    result.dialCallId !== source.dialCallId
  ) {
    throw new Error("Quote is associated with the wrong repair, version, provider or call.");
  }
  for (const span of result.evidence) {
    if (source.turns[span.turnIndex]?.speaker !== "user") {
      throw new Error("Quote evidence must reference a provider turn.");
    }
  }
  const quote = result.quote;
  const amounts = [quote.priceLowUsd, quote.priceHighUsd, quote.visitFeeUsd];
  if (amounts.some((amount) => amount !== null && (!Number.isFinite(amount) || amount < 0))) {
    throw new Error("Price must be nonnegative or null.");
  }
  if (quote.priceLowUsd !== null && quote.priceHighUsd !== null && quote.priceLowUsd > quote.priceHighUsd) {
    throw new Error("Price range is reversed.");
  }
  const hasEvidence = (field: QuoteResult["evidence"][number]["field"]) => result.evidence.some((item) => item.field === field);
  if ((quote.priceLowUsd !== null || quote.priceHighUsd !== null) && !hasEvidence("price")) throw new Error("Repair price requires provider evidence.");
  if (quote.visitFeeUsd !== null && !hasEvidence("fee")) throw new Error("Visit fee requires provider evidence.");
  if (result.feeTreatment === "none" && quote.visitFeeUsd !== 0) throw new Error("No visit fee must be represented as confirmed zero.");
  if (quote.availability.length && !hasEvidence("availability")) throw new Error("Availability requires provider evidence.");
  if (result.collectionStatus === "complete" && result.uncollectedFields.length) throw new Error("A complete result cannot have uncollected fields.");
  if (result.collectionStatus === "partial" && !result.uncollectedFields.length) throw new Error("A partial result must identify uncollected fields.");
  if (["quote_received", "inspection_only"].includes(result.outcome) && !quote.availability.length && !result.uncollectedFields.includes("availability")) {
    throw new Error("Uncollected availability must remain explicit.");
  }
  if (quote.visitFeeUsd !== null && quote.visitFeeUsd > 0 && result.feeTreatment === "unknown" && !result.uncollectedFields.includes("fee_treatment")) {
    throw new Error("Unknown fee treatment must remain explicit.");
  }
  if (result.outcome === "inspection_only" && (quote.priceLowUsd !== null || quote.priceHighUsd !== null)) {
    throw new Error("An inspection fee is not a repair quote.");
  }
  if (result.feeTreatment === "waived_if_hired" && (quote.visitFeeUsd === null || !quote.conditions || !hasEvidence("conditions"))) {
    throw new Error("A fee waiver needs the stated fee and conditions.");
  }
  if (result.missingInformation.length && !hasEvidence("missingInformation")) throw new Error("Missing-information requests need evidence.");
  if (result.outcome === "inspection_only" && quote.pricingType !== "inspection_only") throw new Error("Inspection-only offers must use inspection_only pricing.");
  if (result.quoteBasis === "photos_and_call" && result.photoReviewState !== "reviewed") throw new Error("A photo-based quote requires confirmed photo review.");
  if (result.photoReviewState === "reviewed" && !hasEvidence("photo_review")) throw new Error("Photo review requires provider evidence.");
  return {
    ...result,
    // Store canonical speech-to-text, not the extractor's punctuation or number normalization.
    evidence: result.evidence.map((span) => ({
      ...span,
      providerText: source.turns[span.turnIndex].text,
    })),
  };
}
