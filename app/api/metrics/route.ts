import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import * as keewano from "@/lib/keewano";
import { listRequests } from "@/lib/store";

// Time-saved meter (spec §10): measured in-app active time vs a labeled survey-based baseline,
// plus Keewano's before/after median minutes-to-book.
export async function GET() {
  const scheduled = listRequests().filter((r) => r.status === "scheduled");
  const userActiveSecAvg = scheduled.length
    ? Math.round(scheduled.reduce((sum, r) => sum + r.userActiveSec, 0) / scheduled.length)
    : null;
  let fromKeewano: Awaited<ReturnType<typeof keewano.metrics>> | null = null;
  let keewanoError: string | null = null;
  try {
    fromKeewano = await keewano.metrics();
  } catch (e) {
    keewanoError = (e as Error).message;
  }
  return NextResponse.json({
    baselineMin: config.baselineMinutes,
    baselineLabel: "Estimate: research + calling 3 providers + phone tag + scheduling (see README sources)",
    userActiveSecAvg,
    scheduledCount: scheduled.length,
    keewano: fromKeewano,
    keewanoError,
  });
}
