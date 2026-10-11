import { after, NextResponse, type NextRequest } from "next/server";
import { isPartSearchRunning, searchPartsForRequest, withLock } from "@/lib/orchestrator";
import { searchingPartSearch } from "@/lib/parts";
import { getRequest, saveRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

// "Search again": re-runs the DIY part search (it first runs automatically after diagnosis).
// Returns 202 with status "searching"; the result arrives through the usual GET poll.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await withLock(id, async () => {
    const req = getRequest(id);
    if (!req) return { status: 404, body: { error: "not found" } };
    const part = req.diagnosis?.fixPath === "diy" ? req.diagnosis.diyPlan?.parts[0] : undefined;
    if (!part) return { status: 400, body: { error: "This request has no DIY part to search for" } };
    if (isPartSearchRunning(id)) return { status: 409, body: { error: "A part search is already running" } };
    req.partSearch = searchingPartSearch(part.name);
    return { status: 202, body: saveRequest(req) };
  });
  if (result.status === 202) after(() => searchPartsForRequest(id));
  return NextResponse.json(result.body, { status: result.status });
}
