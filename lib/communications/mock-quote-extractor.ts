import type { Diagnosis, ReferencedQuoteEvidence, QuoteResult, TranscriptTurn } from "../types";

export interface QuoteExtractionInput {
  requestId: string;
  briefVersion: string;
  providerId: string;
  dialCallId: string;
  transcript: string;
  transcriptTurns: TranscriptTurn[];
  diagnosis: Diagnosis;
}

interface MoneyMention { value: number; index: number }

// Deterministic development extractor. It keeps the app functional with MOCK_CLAUDE=1
// while preserving evidence and unknown fields for P2's model implementation.
export function mockExtractQuote(input: QuoteExtractionInput): QuoteResult {
  const providerTurns = input.transcriptTurns.filter((turn) => turn.speaker === "user" && turn.text.trim());
  if (!providerTurns.length) throw new Error("No provider turns are available for quote extraction.");

  const feeTurn = providerTurns.find((turn) => /\b(fee|diagnostic|service call|visit charge)\b/i.test(turn.text));
  const noFeeTurn = providerTurns.find((turn) => /\b(no separate (?:service|visit|diagnostic)?\s*(?:call )?(?:charge|fee)|no (?:visit|diagnostic) fee|all in)\b/i.test(turn.text));
  const feeMention = feeTurn ? closestMoneyTo(feeTurn.text, /\b(fee|diagnostic|service call|visit charge)\b/i) : null;
  const inspectionOnly = providerTurns.some((turn) => /\b(inspection visit|not a repair price|no repair (?:price|estimate)|can't quote (?:a )?(?:total )?repair|cannot quote (?:a )?(?:total )?repair)\b/i.test(turn.text));

  const priceCandidates = providerTurns.flatMap((turn) => {
    if (!/\b(price|quote|estimate|range|flat|repair|do it for)\b/i.test(turn.text)) return [];
    return moneyMentions(turn.text)
      .filter((mention) => !(!noFeeTurn && feeTurn === turn && feeMention && mention.index === feeMention.index && mention.value === feeMention.value))
      .map((mention) => ({ ...mention, turn }));
  });
  const prices = inspectionOnly ? [] : [...new Set(priceCandidates.map((item) => item.value))].filter((value) => value > 0 && value < 100_000);
  const visitFeeUsd = noFeeTurn ? 0 : feeMention?.value ?? null;
  const feeTreatment = noFeeTurn
    ? "none" as const
    : feeTurn && /waiv/i.test(feeTurn.text)
      ? "waived_if_hired" as const
      : feeTurn && /\b(included|credited|applied to)\b/i.test(feeTurn.text)
        ? "included" as const
        : feeTurn && /\b(additional|separate|plus|not credited)\b/i.test(feeTurn.text)
          ? "additional" as const
          : "unknown" as const;

  const availabilityTurns = providerTurns.filter((turn) =>
    /\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(turn.text) &&
    /(?:\d\s*(?:am|pm)\b|\b(?:am|pm|morning|afternoon|noon|opening|available|availability)\b)/i.test(turn.text),
  );
  const warrantyTurn = providerTurns.find((turn) => /\b(warranty|guarantee)\b/i.test(turn.text));
  const conditionTurns = providerTurns.filter((turn) => /\b(provisional|confirm(?:ed)? (?:on|after)|on[- ]site|corrod|nonstandard|additional parts|code related|waiv|if (?:they|you|the customer) (?:hire|proceed))\b/i.test(turn.text));
  const scopeTurn = providerTurns.find((turn) => /\b(includ|labor|fittings|reseal|replace|inspection visit)/i.test(turn.text))
    ?? providerTurns.find((turn) => /\b(repair|inspection|basket strainer|slip joint|trap)\b/i.test(turn.text));
  const requestedInfoTurns = providerTurns.filter((turn) =>
    /\?|\b(?:we(?:'d| would)? need|need a|do you know|has anyone noticed|what (?:kind|type|size|material))\b/i.test(turn.text) &&
    !/\b(can I help|how can I help)\b/i.test(turn.text),
  );

  const declined = providerTurns.some((turn) => /\b(can't help|cannot help|do not handle|don't handle|decline)\b/i.test(turn.text));
  const outcome = declined
    ? "declined" as const
    : inspectionOnly
      ? "inspection_only" as const
      : prices.length
        ? "quote_received" as const
        : "needs_information" as const;

  const evidence: ReferencedQuoteEvidence[] = [];
  const addEvidence = (field: ReferencedQuoteEvidence["field"], turn: TranscriptTurn) => evidence.push({
    field,
    turnIndex: input.transcriptTurns.indexOf(turn),
    providerText: turn.text,
  });
  if (prices.length && priceCandidates[0]) addEvidence("price", priceCandidates[0].turn);
  if (feeTurn) addEvidence("fee", feeTurn);
  else if (noFeeTurn) addEvidence("fee", noFeeTurn);
  if (scopeTurn) addEvidence("scope", scopeTurn);
  if (warrantyTurn) addEvidence("warranty", warrantyTurn);
  for (const turn of conditionTurns.slice(0, 2)) addEvidence("conditions", turn);
  for (const turn of availabilityTurns.slice(0, 2)) addEvidence("availability", turn);
  for (const turn of requestedInfoTurns.slice(0, 3)) addEvidence("missingInformation", turn);
  if (!evidence.length) addEvidence("scope", providerTurns[0]);

  const uncollectedFields: QuoteResult["uncollectedFields"] = [];
  if (!prices.length && outcome !== "inspection_only" && outcome !== "declined") uncollectedFields.push("repair_price");
  if (!feeTurn && !noFeeTurn) uncollectedFields.push("fee");
  if (visitFeeUsd !== null && visitFeeUsd > 0 && feeTreatment === "unknown") uncollectedFields.push("fee_treatment");
  if (!scopeTurn) uncollectedFields.push("scope");
  if (!availabilityTurns.length && outcome !== "declined") uncollectedFields.push("availability");
  if (!warrantyTurn && outcome !== "declined") uncollectedFields.push("warranty");

  const priceLowUsd = prices.length ? Math.min(...prices) : null;
  const priceHighUsd = prices.length ? Math.max(...prices) : null;
  const conditions = conditionTurns.length ? unique(conditionTurns.map((turn) => turn.text)).join(" ") : null;
  const quoteBasis = inspectionOnly || input.diagnosis.needsOnsiteInspection ? "inspection_required" as const : "description_only" as const;
  const pricingText = providerTurns.map((turn) => turn.text).join(" ").replace(/\b(?:not|isn't|is not|never)\s+hourly\b/gi, "");
  const hourly = /\b(?:per hour|hourly|an hour)\b/i.test(pricingText) && !/\bflat (?:rate|price|repair|quote|estimate)\b/i.test(pricingText);
  return {
    requestId: input.requestId,
    briefVersion: input.briefVersion,
    providerId: input.providerId,
    dialCallId: input.dialCallId,
    extractionMethod: "deterministic_mock",
    outcome,
    collectionStatus: uncollectedFields.length ? "partial" : "complete",
    uncollectedFields,
    quote: {
      priceLowUsd,
      priceHighUsd,
      pricingType: inspectionOnly ? "inspection_only" : hourly ? "hourly" : prices.length ? "flat" : "unknown",
      visitFeeUsd,
      availability: unique(availabilityTurns.map((turn) => turn.text)).slice(0, 2),
      needsInspection: inspectionOnly || providerTurns.some((turn) => /\binspect|on[- ]site|on arrival\b/i.test(turn.text)),
      scope: scopeTurn?.text ?? null,
      warranty: warrantyTurn?.text ?? null,
      conditions,
      notes: "Deterministic mock extraction from provider turns; connect P2's model extractor for production semantics.",
      confidence: outcome === "quote_received" || outcome === "inspection_only" ? 0.75 : 0.4,
    },
    feeTreatment,
    missingInformation: unique(requestedInfoTurns.map((turn) => turn.text)),
    quoteBasis,
    photoReviewState: "not_reviewed",
    evidence,
  };
}

function closestMoneyTo(text: string, pattern: RegExp): MoneyMention | null {
  const anchor = text.search(pattern);
  return moneyMentions(text).sort((a, b) => Math.abs(a.index - anchor) - Math.abs(b.index - anchor))[0] ?? null;
}

function moneyMentions(text: string): MoneyMention[] {
  const mentions: MoneyMention[] = [];
  for (const match of text.matchAll(/(?:\$|\bUSD\s*)(\d+(?:\.\d{1,2})?)/gi)) {
    mentions.push({ value: Number(match[1]), index: match.index ?? 0 });
  }
  const numberWord = "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|to";
  const wordDollars = new RegExp(`\\b((?:(?:${numberWord})[\\s-]+){0,14}(?:${numberWord}))\\s+dollars?\\b`, "gi");
  for (const match of text.matchAll(wordDollars)) {
    const parts = match[1].split(/\s+to\s+/i);
    let offset = match.index ?? 0;
    for (const part of parts) {
      const value = parseNumberWords(part);
      if (value !== null) mentions.push({ value, index: offset });
      offset += part.length + 4;
    }
  }
  return uniqueMentions(mentions);
}

function parseNumberWords(input: string): number | null {
  const small: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const word of input.toLowerCase().replaceAll("-", " ").split(/\s+/)) {
    if (word === "and") continue;
    if (word in small) {
      current += small[word];
      sawNumber = true;
    } else if (word === "hundred") {
      current = Math.max(current, 1) * 100;
      sawNumber = true;
    } else if (word === "thousand") {
      total += Math.max(current, 1) * 1000;
      current = 0;
      sawNumber = true;
    } else {
      return null;
    }
  }
  return sawNumber ? total + current : null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function uniqueMentions(values: MoneyMention[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.index}:${value.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
