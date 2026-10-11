import { NextResponse, type NextRequest } from "next/server";
import { rankForRequest, startQuoteCalls, withLock } from "@/lib/orchestrator";
import { getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

// Keewano ranks providers for the diagnosed trade → top 3 get parallel Dial quote calls.
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await withLock(id, async () => {
    const req = getRequest(id);
    if (!req) return { status: 404, body: { error: "not found" } };
    if (req.status === "emergency") {
      return { status: 409, body: { error: "Emergency issues are out of scope: contact emergency services or the utility." } };
    }
    // "failed" = nobody quoted last round: retrying reaches the next-ranked providers.
    if ((req.status !== "diagnosed" && req.status !== "failed") || !req.diagnosis) {
      return { status: 409, body: { error: `Outreach can only start from 'diagnosed' or 'failed' (currently '${req.status}')` } };
    }
    const { ranked, providers } = await rankForRequest(req);
    req.rankedProviders = ranked;
    if (!providers.length) return { status: 409, body: { error: "Every matching provider has already been called" } };
    return { status: 200, body: await startQuoteCalls(req, providers) };
  });
  return NextResponse.json(result.body, { status: result.status });
}
