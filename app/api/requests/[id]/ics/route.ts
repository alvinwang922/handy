import { type NextRequest } from "next/server";
import { buildIcs } from "@/lib/ics";
import { getProperty, getProvider, getRequest } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const req = getRequest(id);
  if (!req?.scheduledSlot) return new Response("Not scheduled yet", { status: 404 });
  const provider = getProvider(req.selectedProviderId ?? "");
  const property = getProperty(req.propertyId);
  const ics = buildIcs({
    uid: `${req.id}@handy`,
    slot: req.scheduledSlot,
    summary: `${provider?.name ?? "Repair"}: ${req.diagnosis?.title ?? req.title}`,
    location: `${property?.address ?? ""}, ${req.unit}`,
    description: `Booked by Handy. Access: ${req.accessNote || "contact the property manager"}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="handy-${req.id}.ics"`,
    },
  });
}
