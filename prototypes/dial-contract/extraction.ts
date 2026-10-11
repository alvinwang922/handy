import type { z } from "zod";
import { buildQuoteJob, TranscriptSchema, validateExtractedQuote, type RepairBrief, type ProviderTarget } from "./contract";

// P2 implements this port with its model. The prototype can also accept a clearly
// labeled human/assistant-reviewed extraction. Never substitute persona fixture prices.
export type QuoteExtractor = (input: {
  requestId: string;
  briefVersion: string;
  providerId: string;
  diagnosis: RepairBrief["diagnosis"];
  serviceArea: RepairBrief["serviceArea"];
  referenceAt: string;
  source: z.infer<typeof TranscriptSchema>;
}) => Promise<unknown>;

export async function extractAndValidate(
  input: { brief: RepairBrief; provider: ProviderTarget; job: ReturnType<typeof buildQuoteJob>; source: unknown },
  extractor: QuoteExtractor,
) {
  const source = TranscriptSchema.parse(input.source);
  const result = await extractor({
    requestId: input.job.requestId,
    briefVersion: input.job.briefVersion,
    providerId: input.provider.id,
    diagnosis: input.brief.diagnosis,
    serviceArea: input.brief.serviceArea,
    referenceAt: input.brief.referenceAt,
    source,
  });
  return validateExtractedQuote(result, input.job, source);
}
