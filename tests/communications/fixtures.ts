import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Provider, RepairRequest } from "../../lib/types";

export const provider: Provider = {
  id: "provider_demo",
  name: "Demo Plumbing",
  trade: "plumber",
  phone: "+14155550101",
  rating: 4.8,
  reviewCount: 20,
  serviceArea: "San Francisco",
};

export function makeProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "handy-packet-"));
  const uploadDir = path.join(root, "data", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, "repair.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
  return root;
}

export function makeRequest(overrides: Partial<RepairRequest> = {}): RepairRequest {
  return {
    id: "req_demo",
    title: "Leaking kitchen sink",
    description: "Water appears under the sink after the faucet runs.",
    requesterRole: "property_manager",
    propertyId: "p1",
    unit: "Main home",
    room: "Kitchen",
    photoPath: "data/uploads/repair.jpg",
    status: "quoting",
    diagnosis: {
      title: "Likely P-trap connection leak",
      likelyCause: "Loose washer",
      trade: "plumber",
      urgency: "soon",
      needsOnsiteInspection: false,
      costRangeUsd: [100, 300],
      jobBrief: "A slow leak under a kitchen sink.",
      questionsForProviders: [],
      confidence: 0.8,
    },
    unitInsight: null,
    rankedProviders: [],
    calls: [
      {
        id: "call_demo",
        dialCallId: "mock_call_demo",
        providerId: provider.id,
        purpose: "quote",
        dispatchState: "accepted",
        idempotencyKey: "handy:quote:call_demo",
        outboundInstruction: "Demo quote call",
        quoteJob: null,
        state: "In-Progress",
        terminationType: null,
        durationSec: null,
        transcript: null,
        transcriptStatus: "pending",
        transcriptTurns: [],
        transcriptHash: null,
        quote: null,
        quoteResult: null,
        booking: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        error: null,
        extractionStatus: "not_started",
        extractionError: null,
        extractAttempts: 0,
      },
    ],
    selectedProviderId: null,
    offeredSlots: [],
    accessNote: "Door code 1234. Exact address: 1 Private Way.",
    approval: null,
    scheduledSlot: null,
    notice: null,
    timeline: [],
    userActiveSec: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
