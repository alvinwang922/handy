import type { Diagnosis, Provider, Quote, Trade, UnitInsight } from "./types";

// Owner: P1. System prompts for Dial's managed voice agent (outboundInstruction / inboundInstruction).
// Non-negotiables (spec §8): disclose AI up front, never commit on a quote call, never give the
// exact address on a quote call.

const disclosure = (company: string) =>
  `Open with: "Hi, this is an AI assistant calling on behalf of ${company}." If anyone asks, confirm you are an AI assistant.`;

export function formatQuote(q: Quote | null): string {
  if (!q) return "no clear quote was captured";
  const price =
    q.priceLowUsd != null && q.priceHighUsd != null && q.priceLowUsd !== q.priceHighUsd
      ? `$${q.priceLowUsd}–$${q.priceHighUsd}`
      : q.priceLowUsd != null
        ? `$${q.priceLowUsd}`
        : "price not given";
  const fee = q.visitFeeUsd != null ? ` plus a $${q.visitFeeUsd} visit fee` : "";
  return `${price} (${q.pricingType.replace(/_/g, " ")})${fee}`;
}

export function quoteInstruction(p: Provider, d: Diagnosis, u: UnitInsight | null, company: string): string {
  const questions = [
    "A price estimate or range for this job, and how they price it (flat rate, hourly, or a visit/diagnostic fee plus parts and labor).",
    "Their two earliest available time windows this week.",
    "Whether they need to inspect in person before giving a firm price.",
  ];
  if (u?.recommendReplaceQuote) questions.push(`${u.note}. Ask for a price to replace it instead of repairing it.`);
  if (d.needsOnsiteInspection) questions.push("Ask what an inspection visit costs, since this likely needs one.");

  return [
    `You are a polite, efficient phone assistant calling ${p.name}, a ${p.trade} business, to get a price quote for a property manager.`,
    disclosure(company),
    `The job: ${d.jobBrief}`,
    `Location: ${p.serviceArea}. Do not give the exact address; say it will be shared when booking.`,
    `Ask these one at a time and keep the call under 3 minutes:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
    d.questionsForProviders.length ? `If it comes up naturally, also ask: ${d.questionsForProviders.join("; ")}.` : "",
    `Rules: Do NOT book, commit, or agree to any price. If they ask for details you don't know, say the property manager will follow up.`,
    `Before hanging up, read back the price and the time windows you heard, thank them, and say "we'll call back to confirm."`,
    `If you reach voicemail, leave a short message asking them to call back this number about a ${p.trade} quote, then hang up.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function bookingInstruction(
  p: Provider,
  d: Diagnosis,
  q: Quote | null,
  slots: string[],
  access: string,
  company: string,
): string {
  return [
    `You are calling ${p.name} back to book a job they quoted earlier today.`,
    disclosure(company),
    `Job: ${d.jobBrief}`,
    `Their quote: ${formatQuote(q)}. Do not agree to anything outside that quote.`,
    `Offer these time windows in order of preference and confirm exactly one: ${slots.join("; ")}.`,
    `Once a window is agreed, confirm the price, then give the service address and access details: ${access}`,
    `Read back the confirmed window and the address before ending the call.`,
    `If none of the windows work, ask for their next two openings and say the property manager will confirm.`,
  ].join("\n\n");
}

// Persona for the second Dial number that plays an AI receptionist in the demo (labeled simulated).
export function receptionistInstruction(persona: { name: string; trade: Trade }): string {
  return [
    `You are the receptionist at ${persona.name}, a ${persona.trade} company in San Francisco. Some callers are AI assistants requesting quotes for property managers; treat them like any customer.`,
    `For a leak or drain repair, quote $180–250 flat. There is an $89 diagnostic visit fee, waived if they hire us. Earliest openings: Tuesday 9–11am or Wednesday 1–3pm.`,
    `Ask one short clarifying question about the issue (for example, whether the leak is at the drain trap or the supply line).`,
    `If they call to book one of those windows, accept it, take the address and access instructions, and confirm the booking.`,
    `Keep every answer short and natural.`,
  ].join("\n\n");
}
