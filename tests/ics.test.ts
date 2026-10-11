import { describe, expect, it } from "vitest";
import { buildIcs, parseSlotStart } from "../lib/ics";

const sunday = new Date("2026-10-11T12:00:00"); // demo day is a Sunday

describe("parseSlotStart", () => {
  it("finds the next weekday and hour", () => {
    const d = parseSlotStart("Tuesday 9 to 11am", sunday);
    expect([d.getDay(), d.getHours(), d.getDate()]).toEqual([2, 9, 13]);
  });

  it("treats a trailing pm as the meridiem of the start time", () => {
    expect(parseSlotStart("Tue 2 to 4pm", sunday).getHours()).toBe(14);
  });

  it("falls back to tomorrow 9am for unparseable slots", () => {
    const d = parseSlotStart("whenever works", sunday);
    expect([d.getDate(), d.getHours()]).toEqual([12, 9]);
  });
});

describe("buildIcs", () => {
  it("emits a VEVENT with escaped fields", () => {
    const ics = buildIcs({ uid: "r1@handy", slot: "Tue 9–11am", summary: "Fix, sink", location: "124 Maple", description: "x" });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Fix\\, sink");
    expect(ics).toContain("DTSTART:20261013T090000");
  });

  it("cannot be injected with CRLF in user-supplied text", () => {
    const ics = buildIcs({ uid: "r1@handy", slot: "Tue 9am", summary: "x", location: "y", description: "note\r\nATTENDEE:mailto:evil@example.com" });
    expect(ics.split("\r\n").some((line) => line.startsWith("ATTENDEE"))).toBe(false);
  });
});
