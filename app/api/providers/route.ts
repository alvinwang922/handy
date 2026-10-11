import { NextResponse } from "next/server";
import { listProviders } from "@/lib/store";

// Display data for the UI (names, ratings). Phone numbers are never returned: real ones are
// teammates' personal numbers from data/providers.local.json.
export async function GET() {
  return NextResponse.json(
    listProviders().map(({ id, name, trade, rating, reviewCount, serviceArea }) => ({ id, name, trade, rating, reviewCount, serviceArea })),
  );
}
