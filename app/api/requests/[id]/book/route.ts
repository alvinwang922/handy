import { NextResponse, type NextRequest } from "next/server";
import { formatQuote } from "@/lib/instructions";
import * as keewano from "@/lib/keewano";
import { startBookingCall, withLock } from "@/lib/orchestrator";
import { getProvider, getRequest, nowIso } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

interface BookBody {
  providerId?: string;
  quoteCallId?: string;
  quoteRevision?: string;
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
    const providerQuoteCalls = req.calls.filter((c) => c.purpose === "quote" && c.providerId === body.providerId && c.quote !== null);
    const quoteCall = body.quoteCallId
      ? providerQuoteCalls.find((call) => call.id === body.quoteCallId)
      : providerQuoteCalls.at(-1);
    if (!provider || !quoteCall) return { status: 400, body: { error: "provider was not part of this request's outreach" } };
    // Only a provider who actually quoted can be approved and booked (no "callback" to someone who never answered).
    const quote = quoteCall.quote;
    if (
      quoteCall.terminationType !== "completed" || !quote || quote.outcome === "declined" ||
      (quote.priceLowUsd == null && quote.priceHighUsd == null && quote.visitFeeUsd == null)
    ) {
      return { status: 409, body: { error: "This provider has no quote to approve" } };
    }
    // An inspection-only offer approves the visit fee, never an invented repair total.
    const inspectionOnly = quote.outcome === "inspection_only" || (quote.priceLowUsd == null && quote.priceHighUsd == null);
    if (quoteCall.quoteResult && !["quote_received", "inspection_only"].includes(quoteCall.quoteResult.outcome)) {
      return { status: 409, body: { error: "This provider needs more information before there is a quote to approve" } };
    }
    const quoteRevision = quoteCall.transcriptHash ?? quoteCall.quoteJob?.briefHash ?? quoteCall.id;
    if (body.quoteRevision && body.quoteRevision !== quoteRevision) {
      return { status: 409, body: { error: "This quote changed; review the latest version before booking" } };
    }
    req.approval = {
      providerId: provider.id,
      quoteCallId: quoteCall.id,
      quoteRevision,
      amountUsd: inspectionOnly ? quote.visitFeeUsd : (quote.priceHighUsd ?? quote.priceLowUsd),
      basis: inspectionOnly ? "inspection_visit" : "repair_quote",
      approvedAt: nowIso(),
      consentText: body.consentText ?? `Approved ${provider.name} at ${formatQuote(quote, quoteCall.quoteResult?.feeTreatment)}; book one of: ${slots.join("; ")}`,
    };
    req.userActiveSec += Number(body.userActiveSec) || 0;
    if (req.approval.amountUsd != null) {
      void keewano.track({ kind: "request", id }, [{ name: "QuoteApprovedCents", value: Math.round(req.approval.amountUsd * 100) }]);
    }
    return { status: 200, body: await startBookingCall(req, provider.id, slots, body.accessNote ?? "") };
  });
  return NextResponse.json(result.body, { status: result.status });
}
