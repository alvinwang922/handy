import { describe, expect, it } from "vitest";
import { EVENTS, entityUuid, uuidv5 } from "../lib/keewano";

describe("uuidv5", () => {
  it("matches Python's uuid.uuid5(NAMESPACE_URL, ...)", () => {
    expect(uuidv5("customer-42")).toBe("44d310bf-c89e-5a92-8766-b155e0038c86");
    expect(entityUuid({ kind: "provider", id: "plumb_rooter" })).toBe("631ac0bf-b636-518a-806f-35a0b923150d");
  });
});

describe("event registry", () => {
  it("uses unique custom ids >= 2000", () => {
    const ids = Object.values(EVENTS).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBeGreaterThanOrEqual(2000);
  });
});
