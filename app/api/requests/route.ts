import fs from "node:fs";
import path from "node:path";
import { after, NextResponse } from "next/server";
import * as claude from "@/lib/claude";
import { config } from "@/lib/config";
import * as keewano from "@/lib/keewano";
import { searchPartsForRequest } from "@/lib/orchestrator";
import { searchingPartSearch } from "@/lib/parts";
import { getProperty, listRequests, newId, nowIso, saveRequest, UPLOAD_DIR } from "@/lib/store";
import type { RepairRequest } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listRequests());
}

// Claude vision accepts only these; the UI should convert HEIC and downscale to ~1568px JPEG.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Deterministic backstop (CLAUDE.md rule 4): these exit the flow no matter what the model says.
const EMERGENCY = /\bgas\b[^.]{0,40}\b(leak|smell)|smell\w*\s+(of\s+|like\s+)?gas\b|\bspark|\bsmoke\b|\bfire\b|\bflood|\bburst\b|sewage backup|carbon monoxide/i;
const SAFETY_NOTICE =
  "Possible emergency (gas, fire, smoke, sparks or flooding). If anyone is in danger, leave and call 911; for gas or power, call your utility's emergency line. Handy does not dispatch emergency repairs.";

// multipart: photo?, title?, description, propertyId, unit?, room?, userActiveSec?
export async function POST(request: Request) {
  const form = await request.formData();
  const str = (k: string) => String(form.get(k) ?? "").trim();

  const description = str("description");
  const propertyId = str("propertyId") || "p1";
  const property = getProperty(propertyId);
  if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });
  if (!property) return NextResponse.json({ error: `unknown propertyId ${propertyId}` }, { status: 400 });

  const id = newId("req");
  let photo: Buffer | null = null;
  let mediaType = "image/jpeg";
  let photoPath: string | null = null;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    mediaType = file.type || mediaType;
    if (!EXT[mediaType]) {
      return NextResponse.json({ error: `Unsupported photo type ${mediaType}: send JPEG, PNG, WebP or GIF (convert HEIC first)` }, { status: 415 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "Photo is over 5 MB: downscale it (about 1568px) before uploading" }, { status: 413 });
    }
    photo = Buffer.from(await file.arrayBuffer());
    const name = `${id}.${EXT[mediaType]}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name), photo);
    photoPath = `data/uploads/${name}`;
  }

  const title = str("title") || description.slice(0, 60);
  const unit = str("unit") || property.units[0];
  const req: RepairRequest = {
    id,
    title,
    description,
    propertyId,
    unit,
    room: str("room"),
    photoPath,
    status: "diagnosed",
    diagnosis: null,
    unitInsight: null,
    rankedProviders: [],
    calls: [],
    selectedProviderId: null,
    offeredSlots: [],
    accessNote: "",
    approval: null,
    scheduledSlot: null,
    notice: null,
    timeline: [],
    userActiveSec: Number(str("userActiveSec")) || 0,
    createdAt: nowIso(),
  };

  try {
    req.diagnosis = await claude.diagnose({ photo, mediaType, description: `${title}. ${description}`, unitInsight: null });
  } catch (e) {
    return NextResponse.json({ error: `Diagnosis failed: ${(e as Error).message}` }, { status: 502 });
  }
  // Recurring-issue check needs the trade, so it runs after diagnosis; it shapes the quote-call script.
  if (EMERGENCY.test(`${title} ${description}`)) req.diagnosis.urgency = "emergency";
  if (req.diagnosis.urgency === "emergency") {
    req.notice = SAFETY_NOTICE;
    // An emergency never gets a DIY suggestion, whatever the model said.
    Object.assign(req.diagnosis, { fixPath: "pro", diyPlan: null, safetyGuidance: req.diagnosis.safetyGuidance || SAFETY_NOTICE });
  }
  req.unitInsight = await keewano.unitInsight(propertyId, unit, req.diagnosis.trade).catch(() => null);
  req.status = req.diagnosis.urgency === "emergency" ? "emergency" : "diagnosed";
  req.timeline.push({ status: req.status, at: nowIso() });

  // Mock-call runs must not count as real bookings in the before/after metric.
  void keewano.track({ kind: "request", id }, [
    { name: "DataSource", value: config.mockDial ? "mock" : "live" },
    { name: "Channel", value: config.mockDial ? "handled_mock" : "handled" },
  ]);
  void keewano.track({ kind: "unit", id: `${propertyId}/${unit}` }, [{ name: "IssueReported", value: req.diagnosis.trade }]);
  // DIY: search for the part after responding (web search takes ~20–60 s); the UI's 3 s poll picks it up.
  const diyPart = req.diagnosis.fixPath === "diy" ? req.diagnosis.diyPlan?.parts[0] : undefined;
  if (diyPart) {
    req.partSearch = searchingPartSearch(diyPart.name);
    after(() => searchPartsForRequest(id));
  }
  saveRequest(req);
  return NextResponse.json(req, { status: 201 });
}
