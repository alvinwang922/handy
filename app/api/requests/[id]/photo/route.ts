import fs from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { resolveUploadFilePath } from "@/lib/communications/packet";
import { getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic" };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const req = getRequest(id);
  if (!req?.photoPath) return new Response("No photo", { status: 404 });
  const file = resolveUploadFilePath(req.photoPath);
  if (!file || !fs.existsSync(/* turbopackIgnore: true */ file)) return new Response("Photo missing", { status: 404 });
  const ext = path.extname(file).slice(1).toLowerCase();
  return new Response(fs.readFileSync(/* turbopackIgnore: true */ file), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
