// Central env access. MOCK_* flags let each module run without real keys.

const flag = (name: string) => process.env[name] === "1" || process.env[name] === "true";

export const config = {
  mockDial: flag("MOCK_DIAL"),
  mockClaude: flag("MOCK_CLAUDE"),
  // Real diagnosis + mock transcript extraction until extractQuote/extractBooking land.
  mockClaudeExtract: flag("MOCK_CLAUDE") || flag("MOCK_CLAUDE_EXTRACT"),
  // Part-search agent (Claude web search) for DIY diagnoses.
  mockParts: flag("MOCK_CLAUDE") || flag("MOCK_PARTS"),
  mockKeewano: flag("MOCK_KEEWANO"),
  maxConcurrentCalls: Number(process.env.MAX_CONCURRENT_CALLS ?? 2),
  quoteFanout: Number(process.env.QUOTE_FANOUT ?? 3),
  companyName: process.env.COMPANY_NAME ?? "Maple Property Management",
  serviceAreaCity: process.env.SERVICE_AREA_CITY ?? "San Francisco",
  serviceAreaRegion: process.env.SERVICE_AREA_REGION ?? "CA",
  propertyTimeZone: process.env.PROPERTY_TIME_ZONE ?? "America/Los_Angeles",
  callbackNumber: process.env.DIAL_FROM_NUMBER ?? "",
  quoteCallMaxSec: Number(process.env.QUOTE_CALL_MAX_SEC ?? 240),
  bookingCallMaxSec: Number(process.env.BOOKING_CALL_MAX_SEC ?? 180),
  baselineMinutes: 108, // labeled estimate — see spec §10
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example), or set the matching MOCK_* flag`);
  return v;
}
