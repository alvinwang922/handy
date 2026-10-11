import fs from "node:fs";
import path from "node:path";
import { type NextRequest } from "next/server";
import { getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic" };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const req = getRequest(id);
  if (!req?.photoPath) return new Response("No photo", { status: 404 });
  const file = path.join(process.cwd(), req.photoPath);
  if (!fs.existsSync(file)) return new Response("Photo missing", { status: 404 });
  const ext = path.extname(file).slice(1);
  return new Response(fs.readFileSync(file), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" } });
}
