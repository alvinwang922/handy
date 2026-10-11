import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { buildRepairPacket, previewRepairPacket, resolveUploadFilePath } from "../../lib/communications/packet";
import { makeProjectRoot, makeRequest, provider } from "./fixtures";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("repair packet", () => {
  it("builds a provider-safe packet without address or access details", () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const packet = previewRepairPacket(makeRequest(), provider, { projectRoot });

    expect(packet.canSend).toBe(true);
    expect(packet.photos).toEqual([
      expect.objectContaining({ id: "primary", contentType: "image/jpeg", previewUrl: "/api/requests/req_demo/photo" }),
    ]);
    expect(packet.summary).toContain("Kitchen");
    expect(packet.summary).toContain("confirm what repair scope");
    expect(packet.summary).not.toContain("Door code");
    expect(packet.summary).not.toContain("Private Way");
  });

  it("changes the packet version when the issue description changes", () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const original = buildRepairPacket(makeRequest(), { projectRoot });
    const revised = buildRepairPacket(makeRequest({ description: "The supply line now sprays continuously." }), { projectRoot });
    expect(revised.packetVersion).not.toBe(original.packetVersion);
  });

  it("does not allow routine sharing for an emergency", () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    const packet = previewRepairPacket(makeRequest({ status: "emergency" }), provider, { projectRoot });
    expect(packet.canSend).toBe(false);
    expect(packet.warnings.join(" ")).toMatch(/Emergency/);
  });

  it("rejects photo paths outside the upload directory", () => {
    const projectRoot = makeProjectRoot();
    roots.push(projectRoot);
    expect(resolveUploadFilePath("../../private.jpg", projectRoot)).toBeNull();
    expect(previewRepairPacket(makeRequest({ photoPath: "../../private.jpg" }), provider, { projectRoot }).canSend).toBe(false);
  });
});
