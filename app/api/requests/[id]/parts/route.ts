import { after, NextResponse, type NextRequest } from "next/server";
import { isPartSearchRunning, partForSearch, searchPartsForRequest, withLock } from "@/lib/orchestrator";
import { searchingPartSearch } from "@/lib/parts";
import { getRequest, saveRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

// Starts (or re-runs) the part-search agent. For a DIY diagnosis it runs automatically after
// diagnosis; this route also lets the user trigger it on demand for a pro-path diagnosis — reviewing
// a professional as the recommended fix doesn't take away the option to look for the part yourself.
// Never offered for an emergency. Returns 202 with status "searching"; the result arrives via the usual GET poll.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await withLock(id, async () => {
    const req = getRequest(id);
    if (!req) return { status: 404, body: { error: "not found" } };
    const search = partForSearch(req.diagnosis);
    if (!search) return { status: 400, body: { error: "No part to search for on this request (missing diagnosis, or it's an emergency)" } };
    if (isPartSearchRunning(id)) return { status: 409, body: { error: "A part search is already running" } };
    req.partSearch = searchingPartSearch(search.part?.name ?? "the right replacement part");
    return { status: 202, body: saveRequest(req) };
  });
  if (result.status === 202) after(() => searchPartsForRequest(id));
  return NextResponse.json(result.body, { status: result.status });
}
