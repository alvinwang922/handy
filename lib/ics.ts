// Best-effort .ics for a human-readable slot like "Tue 9–11am" or "Tuesday 2 to 4pm".
// Floating local time (no TZ) — calendar apps place it in the viewer's timezone.

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function parseSlotStart(slot: string, now = new Date()): Date {
  const s = slot.toLowerCase();
  const day = DAYS.findIndex((d) => new RegExp(`\\b${d}`).test(s));
  const hourMatch = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = hourMatch ? Number(hourMatch[1]) : 9;
  const minute = hourMatch?.[2] ? Number(hourMatch[2]) : 0;
  // "2 to 4pm" → the meridiem appears after the end time; fall back to the first am/pm in the string.
  const meridiem = hourMatch?.[3] ?? s.match(/(am|pm)/)?.[1];
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (!meridiem && hour < 7) hour += 12; // "1–3" for a repair visit means afternoon

  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  if (day >= 0) {
    const delta = (day - now.getDay() + 7) % 7 || 7; // next occurrence, never today
    start.setDate(now.getDate() + delta);
  } else {
    start.setDate(now.getDate() + 1);
  }
  return start;
}

const fmt = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T` +
  `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;

const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function buildIcs(e: { uid: string; slot: string; summary: string; location: string; description: string }): string {
  const start = parseSlotStart(e.slot);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
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
