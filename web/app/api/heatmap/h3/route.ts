import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import {
  aggregateListingsToH3,
  parseH3Resolution,
} from "@/lib/h3Heatmap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city")?.trim();
  const propertyType = searchParams.get("propertyType");
  const estrato = searchParams.get("estrato");
  const resolution = parseH3Resolution(searchParams.get("resolution"));

  if (!city || city === "all") {
    return NextResponse.json(
      { error: "city is required (pick a city for the heatmap)." },
      { status: 400 },
    );
  }

  const estratoParsed =
    estrato && estrato !== "all" ? Number.parseInt(estrato, 10) : Number.NaN;

  try {
    const where = {
      isActive: true,
      city,
      latitude: { not: null },
      longitude: { not: null },
      pricePerM2: { not: null },
      areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      ...(propertyType && propertyType !== "all"
        ? { propertyType }
        : {}),
      ...(!Number.isNaN(estratoParsed) ? { estrato: estratoParsed } : {}),
    };

    const rows = await prisma.listing.findMany({
      where,
      select: {
        latitude: true,
        longitude: true,
        pricePerM2: true,
        neighborhood: true,
      },
    });

    const listings = rows
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          r.pricePerM2 != null &&
          Number.isFinite(r.latitude) &&
          Number.isFinite(r.longitude),
      )
      .map((r) => ({
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        pricePerM2: r.pricePerM2 as number,
        neighborhood: r.neighborhood,
      }));

    if (listings.length < MIN_SAMPLE_SIZE) {
      return NextResponse.json({
        city,
        resolution,
        cells: [],
        scale: { p25: null, p50: null, p75: null },
        listingCount: listings.length,
        cellCount: 0,
        minSampleMet: false,
      });
    }

    const { cells, scale, listingCount } = aggregateListingsToH3(
      listings,
      resolution,
    );

    return NextResponse.json({
      city,
      resolution,
      cells,
      scale,
      listingCount,
      cellCount: cells.length,
      minSampleMet: true,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
