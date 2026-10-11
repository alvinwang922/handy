import { NextResponse, type NextRequest } from "next/server";
import { isLocked, refresh, withLock } from "@/lib/orchestrator";
import { getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

// The UI polls this every ~3s. Each poll advances call state (Dial) and extracts finished transcripts.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const current = getRequest(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  // A refresh (or an outreach/booking write) is already running: return the last saved state.
  if (isLocked(id)) return NextResponse.json(current);
  const fresh = await withLock(id, () => refresh(id));
  return NextResponse.json(fresh ?? current);
}
