import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ExtractedQuoteSchema, validateExtractedQuote } from "./contract";

// Usage: node --import tsx prototypes/dial-contract/review.ts RUN_ID
// Expects .local/RUN_ID/reviewed-quotes.json; no network calls or personas read.
const runId = process.argv[2];
if (!runId || !/^[0-9TZ-]+$/.test(runId)) throw new Error("Provide the recorded run ID.");
const directory = path.resolve("prototypes/dial-contract/.local", runId);
const reviews = z.array(ExtractedQuoteSchema).parse(JSON.parse(fs.readFileSync(path.join(directory, "reviewed-quotes.json"), "utf8")));
const attempts = ["fixed", "range_fee", "inspection"].map(name => JSON.parse(fs.readFileSync(path.join(directory, `${name}.json`), "utf8")));
const results = reviews.map(review => {
  const attempt = attempts.find(item => item.dialCallId === review.dialCallId);
  if (!attempt) throw new Error("Review does not correspond to a recorded live attempt.");
  return validateExtractedQuote(review, attempt.job, attempt.source);
});
if (results.length !== attempts.length || new Set(results.map(r => r.dialCallId)).size !== attempts.length) throw new Error("Need one reviewed result per live call.");
fs.writeFileSync(path.join(directory, "validated-quotes.json"), JSON.stringify(results, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ validatedResults: results.length, liveTranscriptEvidence: true, automaticModelExtraction: false, results: results.map(r => ({ providerId: r.providerId, outcome: r.outcome, collectionStatus: r.collectionStatus, uncollectedFields: r.uncollectedFields, priceLowUsd: r.quote.priceLowUsd, priceHighUsd: r.quote.priceHighUsd, visitFeeUsd: r.quote.visitFeeUsd, feeTreatment: r.feeTreatment, availability: r.quote.availability, missingInformation: r.missingInformation })) }, null, 2));
