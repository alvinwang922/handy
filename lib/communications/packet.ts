import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Provider, RepairRequest } from "../types";
import type { PacketPhoto, RepairPacket, RepairPacketPreview } from "./types";

export const MAX_PACKET_IMAGE_BYTES = 1_000_000;

const SUPPORTED_IMAGES: Record<string, PacketPhoto["contentType"]> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export class PacketError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function buildRepairPacket(
  request: RepairRequest,
  options: { projectRoot?: string } = {},
): RepairPacket {
  const projectRoot = options.projectRoot ?? process.cwd();
  const warnings: string[] = [];
  const photos: PacketPhoto[] = [];

  if (request.status === "emergency") warnings.push("Emergency repairs cannot be sent through routine provider outreach.");
  if (!request.photoPath) {
    warnings.push("Add a photo before sending this repair packet.");
  } else {
    const filePath = resolveUploadFilePath(request.photoPath, projectRoot);
    if (!filePath) {
      warnings.push("The saved photo path is outside the upload directory.");
    } else if (!fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      warnings.push("The saved photo is missing.");
    } else {
      const contentType = SUPPORTED_IMAGES[path.extname(filePath).toLowerCase()];
      const sizeBytes = fs.statSync(/* turbopackIgnore: true */ filePath).size;
      if (!contentType) warnings.push("The first release supports JPEG and PNG photos only.");
      else if (sizeBytes > MAX_PACKET_IMAGE_BYTES) warnings.push("Compress the photo below 1 MB before sending.");
      else {
        const bytes = fs.readFileSync(/* turbopackIgnore: true */ filePath);
        if (!hasImageSignature(bytes, contentType)) {
          warnings.push("The photo contents do not match a JPEG or PNG image.");
        } else {
          photos.push({
            id: "primary",
            contentType,
            sizeBytes,
            sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
            filePath,
            previewUrl: `/api/requests/${encodeURIComponent(request.id)}/photo`,
          });
        }
      }
    }
  }

  const summary = buildSummary(request);
  const versionInput = JSON.stringify({
    requestId: request.id,
    title: request.title,
    description: request.description,
    room: request.room,
    diagnosis: request.diagnosis
      ? {
          title: request.diagnosis.title,
          likelyCause: request.diagnosis.likelyCause,
          jobBrief: request.diagnosis.jobBrief,
        }
      : null,
    photos: photos.map(({ sha256, contentType, sizeBytes }) => ({ sha256, contentType, sizeBytes })),
  });
  const digest = crypto.createHash("sha256").update(versionInput).digest("hex").slice(0, 12);

  return {
    requestId: request.id,
    packetVersion: `pkt_v1_${digest}`,
    summary,
    photos,
    warnings,
    canSend: warnings.length === 0 && photos.length > 0,
  };
}

export function resolveUploadFilePath(photoPath: string, projectRoot = process.cwd()): string | null {
  const uploadRoot = path.resolve(projectRoot, "data/uploads");
  const filePath = path.resolve(projectRoot, photoPath);
  const relative = path.relative(uploadRoot, filePath);
  return relative.startsWith("..") || path.isAbsolute(relative) ? null : filePath;
}

export function previewRepairPacket(request: RepairRequest, provider: Provider, options: { projectRoot?: string } = {}): RepairPacketPreview {
  const packet = buildRepairPacket(request, options);
  const eligible = request.calls.some((call) => call.providerId === provider.id && call.purpose === "quote");
  const warnings = eligible ? packet.warnings : [...packet.warnings, "This provider is not part of the request's quote outreach."];
  return {
    requestId: request.id,
    providerId: provider.id,
    packetVersion: packet.packetVersion,
    summary: packet.summary,
    photos: packet.photos.map(({ id, contentType, sizeBytes, previewUrl }) => ({ id, contentType, sizeBytes, previewUrl })),
    warnings,
    canSend: packet.canSend && eligible,
  };
}

export function requireSendablePacket(request: RepairRequest, provider: Provider, packetVersion: string, options: { projectRoot?: string } = {}): RepairPacket {
  const preview = previewRepairPacket(request, provider, options);
  if (request.status === "emergency") throw new PacketError(422, "Emergency repairs cannot use routine provider outreach.");
  if (!request.calls.some((call) => call.providerId === provider.id && call.purpose === "quote")) {
    throw new PacketError(422, "Provider was not part of this request's quote outreach.");
  }
  const packet = buildRepairPacket(request, options);
  if (packet.packetVersion !== packetVersion) throw new PacketError(409, "Repair packet changed; preview and approve the latest version.");
  if (!preview.canSend) {
    const unsupported = preview.warnings.some((warning) => /JPEG|PNG/.test(warning));
    const oversized = preview.warnings.some((warning) => /1 MB/.test(warning));
    throw new PacketError(unsupported ? 415 : oversized ? 413 : 422, preview.warnings.join(" "));
  }
  return packet;
}

function buildSummary(request: RepairRequest): string {
  const clean = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);
  const room = clean(request.room, 60) || "unspecified room";
  const withoutTrailingPunctuation = (value: string) => value.replace(/[.!?]+$/, "");
  const observed = withoutTrailingPunctuation(clean(request.description, 220));
  const preliminary = withoutTrailingPunctuation(
    request.diagnosis?.title ? clean(request.diagnosis.title, 120) : "not yet classified",
  );
  return [
    `Repair ${request.id}. Room: ${room}.`,
    `Observed issue: ${observed}.`,
    `Preliminary assessment: ${preliminary}.`,
    "Please review the attached photo, describe the issue you see, and confirm what repair scope your estimate covers.",
  ].join(" ");
}

function hasImageSignature(bytes: Buffer, contentType: PacketPhoto["contentType"]): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= png.length && png.every((value, index) => bytes[index] === value);
}
