import { NextResponse, type NextRequest } from "next/server";
import { formatQuote } from "@/lib/instructions";
import * as keewano from "@/lib/keewano";
import { startBookingCall, withLock } from "@/lib/orchestrator";
import { getProvider, getRequest, nowIso } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

interface BookBody {
  providerId?: string;
  slots?: string[];
  accessNote?: string;
  userActiveSec?: number;
  consentText?: string;
}

// This POST *is* the user's explicit approval (PRD principle 1): it records an Approval, then calls to book.
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as BookBody | null;
  const slots = (body?.slots ?? []).map(String).filter(Boolean);
  if (!body?.providerId || !slots.length) {
    return NextResponse.json({ error: "providerId and at least one slot are required" }, { status: 400 });
  }

  const result = await withLock(id, async () => {
    const req = getRequest(id);
    if (!req) return { status: 404, body: { error: "not found" } };
    if (req.status !== "quotes_ready") {
      return { status: 409, body: { error: `Booking needs 'quotes_ready' (currently '${req.status}')` } };
    }
    const provider = getProvider(body.providerId!);
    const quoteCall = req.calls.find((c) => c.purpose === "quote" && c.providerId === body.providerId);
    if (!provider || !quoteCall) return { status: 400, body: { error: "provider was not part of this request's outreach" } };

    const quote = quoteCall.quote;
    req.approval = {
      providerId: provider.id,
      amountUsd: quote?.priceHighUsd ?? quote?.priceLowUsd ?? null,
      approvedAt: nowIso(),
      consentText: body.consentText ?? `Approved ${provider.name} at ${formatQuote(quote)}; book one of: ${slots.join("; ")}`,
    };
    req.userActiveSec += Number(body.userActiveSec) || 0;
    if (req.approval.amountUsd != null) {
      void keewano.track({ kind: "request", id }, [{ name: "QuoteApprovedCents", value: Math.round(req.approval.amountUsd * 100) }]);
    }
    return { status: 200, body: await startBookingCall(req, provider.id, slots, body.accessNote ?? "") };
  });
  return NextResponse.json(result.body, { status: result.status });
}
