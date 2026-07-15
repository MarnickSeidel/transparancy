import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/rateLimit";
import { getCachedHeatmapH3 } from "@/lib/serverCache";

export const revalidate = 120;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
};

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "heatmap-h3", 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim();
  const propertyType = searchParams.get("propertyType");
  const estrato = searchParams.get("estrato");
  const resolution = searchParams.get("resolution");

  if (!city || city === "all") {
    return NextResponse.json(
      { error: "city is required (pick a city for the heatmap)." },
      { status: 400 },
    );
  }

  try {
    const data = await getCachedHeatmapH3({
      city,
      propertyType,
      estrato,
      resolution,
    });
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
