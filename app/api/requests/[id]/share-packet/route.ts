import { NextResponse, type NextRequest } from "next/server";
import { createDialMessageTransport } from "@/lib/communications/dial-messages";
import { presentMessage } from "@/lib/communications/present";
import { communicationErrorStatus, shareRepairPacket } from "@/lib/communications/share-packet";
import { JsonMessageStore } from "@/lib/communications/store";
import { withLock } from "@/lib/orchestrator";
import { getProvider, getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

interface ShareBody {
  providerId?: string;
  packetVersion?: string;
  callId?: string;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as ShareBody | null;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!body?.providerId || !body.packetVersion || !idempotencyKey) {
    return NextResponse.json(
      { error: "providerId, packetVersion, and Idempotency-Key are required" },
      { status: 400 },
    );
  }

  try {
    const result = await withLock(id, async () => {
      const repair = getRequest(id);
      if (!repair) return { status: 404, body: { error: "not found" } };
      const provider = getProvider(body.providerId!);
      if (!provider) return { status: 404, body: { error: "unknown provider" } };
      const message = await shareRepairPacket(
        {
          request: repair,
          provider,
          packetVersion: body.packetVersion!,
          idempotencyKey,
          callId: body.callId ?? null,
        },
        { store: new JsonMessageStore(), transport: createDialMessageTransport() },
      );
      const status = message.dispatchState === "failed" ? 502 : 202;
      return { status, body: presentMessage(message) };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "packet send failed" },
      { status: communicationErrorStatus(error) },
    );
  }
}
