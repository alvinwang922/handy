import { NextResponse, type NextRequest } from "next/server";
import { previewRepairPacket } from "@/lib/communications/packet";
import { getProvider, getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const providerId = request.nextUrl.searchParams.get("providerId")?.trim();
  if (!providerId) return NextResponse.json({ error: "providerId is required" }, { status: 400 });

  const repair = getRequest(id);
  if (!repair) return NextResponse.json({ error: "not found" }, { status: 404 });
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  return NextResponse.json(previewRepairPacket(repair, provider));
}
