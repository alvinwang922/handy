import { NextResponse } from "next/server";
import { presentMessage } from "@/lib/communications/present";
import { JsonMessageStore } from "@/lib/communications/store";
import { getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getRequest(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ messages: new JsonMessageStore().listByRequest(id).map(presentMessage) });
}
