import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import * as claude from "@/lib/claude";
import * as keewano from "@/lib/keewano";
import { getProperty, listRequests, newId, nowIso, saveRequest, UPLOAD_DIR } from "@/lib/store";
import type { RepairRequest } from "@/lib/types";

export async function GET() {
  return NextResponse.json(listRequests());
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

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
    photo = Buffer.from(await file.arrayBuffer());
    mediaType = file.type || mediaType;
    const name = `${id}.${EXT[mediaType] ?? "bin"}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), photo);
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
  req.unitInsight = await keewano.unitInsight(propertyId, unit, req.diagnosis.trade).catch(() => null);
  req.status = req.diagnosis.urgency === "emergency" ? "emergency" : "diagnosed";
  req.timeline.push({ status: req.status, at: nowIso() });

  void keewano.track({ kind: "request", id }, [{ name: "Channel", value: "handled" }]);
  void keewano.track({ kind: "unit", id: `${propertyId}/${unit}` }, [{ name: "IssueReported", value: req.diagnosis.trade }]);
  saveRequest(req);
  return NextResponse.json(req, { status: 201 });
}
