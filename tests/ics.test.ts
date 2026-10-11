import { describe, expect, it } from "vitest";
import { buildIcs, parseSlot, parseSlotStart } from "../lib/ics";

const sunday = new Date("2026-10-11T12:00:00"); // demo day is a Sunday

describe("parseSlotStart", () => {
  it("finds the next weekday and hour", () => {
    const d = parseSlotStart("Tuesday 9 to 11am", sunday);
    expect([d.getDay(), d.getHours(), d.getDate()]).toEqual([2, 9, 13]);
  });

  it("treats a trailing pm as the meridiem of the start time", () => {
    expect(parseSlotStart("Tue 2 to 4pm", sunday).getHours()).toBe(14);
  });

  it.each([
    ["Tue 11–1pm", 2, 11],                    // range crossing noon: start is AM
    ["Tuesday, October 13, 9–11 AM", 2, 9],  // date number and uppercase meridiem
    ["Tuesday 10/13 9-11am", 2, 9],          // numeric date before the range
    ["Wednesday 2 to 4 with Sam", 3, 14],     // no meridiem; "Sam" must not read as "am"
    ["Wednesday 1–3pm", 3, 13],
    ["Thu 12–2pm", 4, 12],
  ])("parses %s", (slot, weekday, hour) => {
    const d = parseSlotStart(slot as string, sunday);
    expect([d.getDay(), d.getHours()]).toEqual([weekday, hour]);
  });

  it("uses an explicit calendar date over the next matching weekday", () => {
    expect(parseSlotStart("Tue, Oct 20 · 9 am–12 pm", sunday).getDate()).toBe(20);
    expect(parseSlotStart("Tuesday 10/20 9-11am", sunday).getDate()).toBe(20);
  });

  it("ends at the range's own end time, else two hours later", () => {
    const at = (slot: string) => { const { start, end } = parseSlot(slot, sunday); return [start.getHours(), end.getHours()]; };
    expect(at("Tue, Oct 13 · 9 am–12 pm")).toEqual([9, 12]);
    expect(at("Tue 11–1pm")).toEqual([11, 13]);
    expect(at("Wednesday 2 to 4 with Sam")).toEqual([14, 16]);
    expect(at("Tue 9am")).toEqual([9, 11]);
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
