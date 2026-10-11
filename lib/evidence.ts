import type { Quote, QuoteEvidence, TranscriptTurn } from "./types";

// Evidence checks for extracted quotes (eng-design/dial-call-results-contract.md).
// Speech-to-text and model output both normalize wording, so exact substring matching rejects
// correct extractions. We compare after normalizing case, punctuation and whitespace, and only
// against the provider's turns ("user" on our outbound calls): our agent's words can't set terms.

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ") // drop sentence periods, keep decimals like 89.50
    .replace(/[^a-z0-9$.' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function evidenceSupported(e: QuoteEvidence, turns: TranscriptTurn[]): boolean {
  const needle = normalizeText(e.providerText);
  if (!needle) return false;
  const providerTurns = turns
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.speaker === "user")
    .filter(({ i }) => e.turnIndex == null || i === e.turnIndex);
  return providerTurns.some(({ t }) => normalizeText(t.text).includes(needle));
}

// Contract rules that keep "unknown" distinct from "zero" and inspection fees distinct from repair
// prices. Returns human-readable problems; empty = OK. Use it to decide whether to re-extract.
export function quoteProblems(q: Quote, turns: TranscriptTurn[] | null | undefined): string[] {
  const problems: string[] = [];
  const has = (field: QuoteEvidence["field"]) => (q.evidence ?? []).some((e) => e.field === field);
  if (q.priceLowUsd != null && q.priceHighUsd != null && q.priceLowUsd > q.priceHighUsd) problems.push("price range reversed");
  if (q.outcome === "inspection_only" && (q.priceLowUsd != null || q.priceHighUsd != null)) {
    problems.push("an inspection fee is not a repair quote");
  }
  if (q.feeTreatment === "none" && q.visitFeeUsd != null && q.visitFeeUsd !== 0) problems.push("feeTreatment none needs visitFeeUsd 0");
  if (q.feeTreatment === "waived_if_hired" && (q.visitFeeUsd == null || !q.conditions)) {
    problems.push("a fee waiver needs the stated fee and its condition");
  }
  if (q.collectionStatus === "complete" && (q.uncollectedFields ?? []).length) problems.push("complete result lists uncollected fields");
  if (q.evidence) {
    if ((q.priceLowUsd != null || q.priceHighUsd != null) && !has("price")) problems.push("price needs provider evidence");
    if (q.visitFeeUsd != null && q.visitFeeUsd > 0 && !has("fee")) problems.push("visit fee needs provider evidence");
    if (turns?.length) {
      for (const e of q.evidence) if (!evidenceSupported(e, turns)) problems.push(`evidence not found in provider turns: "${e.providerText.slice(0, 60)}"`);
    }
  }
  return problems;
}
