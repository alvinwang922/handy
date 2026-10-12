// Best-effort .ics for a human-readable slot like "Tue 9–11am" or "Tuesday 2 to 4pm".
// Floating local time (no TZ) — calendar apps place it in the viewer's timezone.

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DATE_TOKENS =
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/g;
const RANGE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/;
const SINGLE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/;
const BARE = /\b(\d{1,2})(?::(\d{2}))?\b/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_DAY = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/;

const to24 = (hour: number, meridiem: string | undefined) =>
  meridiem === "pm" && hour < 12 ? hour + 12 : meridiem === "am" && hour === 12 ? 0 : hour;

// "9 to 11 a.m." → "9 to 11 am": providers' spoken times often carry dots.
const normalize = (slot: string) => slot.toLowerCase().replace(/\b([ap])\.\s?m\b\.?/g, "$1m");

export function parseSlotStart(slot: string, now = new Date()): Date {
  return parseSlot(slot, now).start;
}

// True when a slot names a day (weekday, calendar date or "tomorrow") and a time. parseSlot falls back
// to defaults otherwise, which must never become a bookable window nobody offered.
export function isSpecificSlot(slot: string): boolean {
  const lower = normalize(slot);
  const day = DAYS.some((d) => new RegExp(`\\b${d}`).test(lower)) || MONTH_DAY.test(lower) || /\btomorrow\b/.test(lower);
  const s = lower.replace(DATE_TOKENS, " ");
  return day && (RANGE.test(s) || SINGLE.test(s));
}

// Start and end of a human-readable slot. An explicit calendar date ("Oct 20", "10/20") wins over the
// weekday; the end is the range's own end time, else start + 2 h.
export function parseSlot(slot: string, now = new Date()): { start: Date; end: Date } {
  const lower = normalize(slot);
  const day = DAYS.findIndex((d) => new RegExp(`\\b${d}`).test(lower));
  const date = lower.match(MONTH_DAY);
  // Drop calendar dates ("10/13", "October 13") so their numbers aren't read as the hour.
  const s = lower.replace(DATE_TOKENS, " ");

  let hour = 9;
  let minute = 0;
  let meridiem: string | undefined;
  let endAt: [number, number] | null = null;
  const range = s.match(RANGE);
  const single = s.match(SINGLE);
  const bare = s.match(BARE);
  if (range) {
    hour = Number(range[1]);
    minute = range[2] ? Number(range[2]) : 0;
    const endHour = Number(range[4]);
    // "2 to 4pm" shares the end's meridiem; "11–1pm" crosses noon, so the start is AM.
    meridiem = range[3] ?? (range[6] === "pm" && hour > endHour && hour !== 12 ? "am" : range[6]);
    let end24 = to24(endHour, range[6] ?? meridiem);
    if (!range[6] && !meridiem && end24 < 7) end24 += 12; // "1–3" for a repair visit means afternoon
    endAt = [end24, range[5] ? Number(range[5]) : 0];
  } else if (single) {
    hour = Number(single[1]);
    minute = single[2] ? Number(single[2]) : 0;
    meridiem = single[3];
  } else if (bare) {
    hour = Number(bare[1]);
    minute = bare[2] ? Number(bare[2]) : 0;
  }
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (!meridiem && hour < 7) hour += 12; // "1–3" for a repair visit means afternoon

  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  if (date) {
    const month = date[1] ? MONTHS.indexOf(date[1]) : Number(date[3]) - 1;
    const dom = Number(date[1] ? date[2] : date[4]);
    start.setFullYear(now.getFullYear(), month, dom);
    if (start.getTime() < now.getTime() - 86_400_000) start.setFullYear(now.getFullYear() + 1, month, dom); // "Jan 5" said in December
  } else if (day >= 0) {
    const delta = (day - now.getDay() + 7) % 7 || 7; // next occurrence, never today
    start.setDate(now.getDate() + delta);
  } else {
    start.setDate(now.getDate() + 1);
  }
  const end = new Date(start);
  if (endAt && endAt[0] * 60 + endAt[1] > hour * 60 + minute) end.setHours(endAt[0], endAt[1], 0, 0);
  else end.setTime(start.getTime() + 2 * 60 * 60 * 1000);
  return { start, end };
}

const fmt = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T` +
  `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;

// RFC 5545 TEXT escaping; CR/LF are folded into "\n" so user input can't inject new properties.
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\r\n|\r|\n/g, "\\n");

export function buildIcs(e: { uid: string; slot: string; summary: string; location: string; description: string }): string {
  const { start, end } = parseSlot(e.slot);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Handy//SpeedHacks//EN",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.summary)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(`${e.description} (slot: ${e.slot})`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
