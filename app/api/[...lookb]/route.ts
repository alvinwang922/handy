import { NextRequest, NextResponse } from "next/server";
import { createHandy } from "@/server/repairs.js";
import { errorResponse, handleApi, maxBodyBytes, parseJSONBody, requireJSONType } from "@/server/api.js";
import { AppError, requireCondition } from "@/server/validation.js";

// Look B demo API (public/app/*), shared with the standalone node server via server/api.js.
// Static routes (/api/requests, /api/metrics, /api/providers) take precedence over this catch-all.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Handy = ReturnType<typeof createHandy>;
const g = globalThis as typeof globalThis & { lookbHandy?: Handy };
function getHandy(): Handy {
  g.lookbHandy ??= createHandy({
    dataPath: process.env.LOOKB_DATA_PATH || (process.env.VERCEL ? "/tmp/handy.sqlite" : "data/handy.sqlite"),
  });
  return g.lookbHandy;
}

async function readJSON(request: NextRequest) {
  requireJSONType(request.headers.get("content-type") ?? undefined);
  if (Number(request.headers.get("content-length")) > maxBodyBytes) throw new AppError(413, "Request is too large.");
  const raw = await request.text();
  requireCondition(Buffer.byteLength(raw) <= maxBodyBytes, "Request is too large.", 413);
  return parseJSONBody(raw);
}

function sameOrigin(origin: string, host: string | null) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function handle(request: NextRequest) {
  let result: { status: number; body: unknown };
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    requireCondition(!origin || sameOrigin(origin, host), "Foreign origins are not allowed.", 403);
    result = await handleApi(getHandy(), {
      method: request.method,
      path: request.nextUrl.pathname,
      searchParams: request.nextUrl.searchParams,
      readBody: () => readJSON(request),
    });
  } catch (error) {
    result = errorResponse(error);
  }
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
