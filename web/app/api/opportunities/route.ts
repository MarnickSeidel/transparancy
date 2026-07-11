import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, percentile } from "@/lib/analytics";
import {
  analyzeDeal,
  buildWhyDeal,
  toDealListingInput,
  type DealListingInput,
} from "@/lib/dealEngine";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseExcludeNeighborhoods(searchParams: URLSearchParams): string[] {
  const set = new Set<string>();
  for (const raw of searchParams.getAll("excludeNeighborhood")) {
    for (const part of raw.split(",")) {
      const t = part.trim();
      if (t) set.add(t);
    }
  }
  return Array.from(set);
}

function neighborhoodPassesFilters(
  value: string | null,
  selectedNeighborhoodKey: string | null,
  excludedNeighborhoodKeys: Set<string>,
  excludeUnknownNeighborhoods: boolean,
): boolean {
  const raw = value?.trim() ?? "";
  const key = raw ? normalizeNeighborhoodKey(raw) : "";
  if (selectedNeighborhoodKey && key !== selectedNeighborhoodKey) return false;
  if (excludedNeighborhoodKeys.size > 0 && key && excludedNeighborhoodKeys.has(key)) {
    return false;
  }
  if (excludeUnknownNeighborhoods) {
    if (!raw) return false;
    if (key === "desconocido" || key === "unknown") return false;
  }
  return true;
}

function minBuiltPpm2ForHouse(pool: DealListingInput[]): number {
  const builtHousePpm2 = pool
    .filter((l) => (l.propertyType ?? "").toLowerCase().includes("casa"))
    .map((l) => l.pricePerM2Built)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  const p15 = percentile(builtHousePpm2, 0.15);
  return p15 != null ? Math.max(900_000, p15 * 0.75) : 900_000;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const propertyType = searchParams.get("propertyType");
  const neighborhood = searchParams.get("neighborhood");
  const selectedNeighborhoodKey =
    neighborhood && neighborhood.trim()
      ? normalizeNeighborhoodKey(neighborhood.trim())
      : null;
  const excludeNeighborhoods = parseExcludeNeighborhoods(searchParams);
  const excludedNeighborhoodKeys = new Set(
    excludeNeighborhoods.map((n) => normalizeNeighborhoodKey(n)).filter(Boolean),
  );
  const excludeUnknownNeighborhoods =
    searchParams.get("excludeUnknownNeighborhoods") === "1";
  const hideLowConfidence = searchParams.get("hideLowConfidence") !== "0";
  const excludeBarter = searchParams.get("excludeBarter") === "1";
  const excludeProjects = searchParams.get("excludeProjects") === "1";
  const minDiscountRaw = searchParams.get("minDiscountPct");
  const minDiscountPct =
    minDiscountRaw != null && minDiscountRaw.trim() !== ""
      ? Number.parseFloat(minDiscountRaw)
      : 0;

  const maxPriceRaw = searchParams.get("maxPriceCop");
  let maxPriceCop: bigint | null = null;
  if (maxPriceRaw != null && maxPriceRaw.trim() !== "") {
    const n = Number.parseInt(maxPriceRaw.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 1_000_000_000_000) {
      maxPriceCop = BigInt(n);
    }
  }

  try {
    const andFilters: Prisma.ListingWhereInput[] = [
      {
        isActive: true,
        pricePerM2: { not: null },
        areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
        operationType: { contains: "venta", mode: "insensitive" },
      },
    ];

    if (maxPriceCop != null) {
      andFilters.push({ priceCop: { lte: maxPriceCop } });
    }
    if (city && city !== "all") andFilters.push({ city });
    if (propertyType && propertyType.trim()) {
      andFilters.push({ propertyType: propertyType.trim() });
    }
    if (excludeBarter) andFilters.push({ acceptsBarter: false });
    if (excludeProjects) andFilters.push({ isProject: false });

    const rows = await prisma.listing.findMany({
      where: { AND: andFilters },
      orderBy: { dateScraped: "desc" },
      take: 5000,
    });

    const filteredRows = rows.filter((r) =>
      neighborhoodPassesFilters(
        r.neighborhood,
        selectedNeighborhoodKey,
        excludedNeighborhoodKeys,
        excludeUnknownNeighborhoods,
      ),
    );

    const pool = filteredRows.map((r) => toDealListingInput(r));
    const houseFloor = minBuiltPpm2ForHouse(pool);

    const listingIds = filteredRows.map((r) => r.id);
    const priceEventsRaw =
      listingIds.length > 0
        ? await prisma.listingPriceEvent.findMany({
            where: {
              listingId: { in: listingIds },
              recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
            },
            orderBy: { recordedAt: "desc" },
          })
        : [];

    const priceEventsByListing = new Map<
      string,
      { priceCop: bigint; recordedAt: Date }[]
    >();
    for (const ev of priceEventsRaw) {
      const arr = priceEventsByListing.get(ev.listingId) ?? [];
      arr.push({ priceCop: ev.priceCop, recordedAt: ev.recordedAt });
      priceEventsByListing.set(ev.listingId, arr);
    }

    const scored = filteredRows
      .map((row) => {
        const subject = toDealListingInput(row);
        const analysis = analyzeDeal(subject, pool, {
          priceEvents: priceEventsByListing.get(row.id),
          minBuiltPpm2ForHouse: houseFloor,
          requirePositiveDiscount: true,
        });
        if (analysis.excluded) return null;
        if (
          analysis.discountVsRefPct == null ||
          analysis.discountVsRefPct < minDiscountPct
        ) {
          return null;
        }
        if (hideLowConfidence && analysis.confidence === "low") return null;

        const whyDeal = buildWhyDeal(analysis, subject);

        return {
          id: row.id,
          title: row.title,
          city: row.city,
          neighborhood: row.neighborhood,
          zoneName: row.zoneName,
          propertyType: row.propertyType,
          priceCop: row.priceCop.toString(),
          areaM2: row.areaM2,
          areaPrivateM2: row.areaPrivateM2,
          pricePerM2: analysis.subjectPpm2,
          metricType: analysis.metricType,
          refAvgUsed: analysis.refPpm2,
          compSampleSize: analysis.compSampleSize,
          compMethod: analysis.compMethod,
          dealScore: analysis.dealScore,
          scoreBreakdown: analysis.breakdown,
          whyDeal,
          confidence: analysis.confidence,
          confidenceReasons: analysis.confidenceReasons,
          discountVsRefPct: analysis.discountVsRefPct,
          priceDropPct: analysis.priceDropPct,
          domDays: analysis.domDays,
          acceptsBarter: row.acceptsBarter,
          terraceHeavy: row.terraceHeavyFlag,
          isProject: row.isProject,
          url: row.url,
          imageUrl: row.imageUrl,
          sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1))
      .slice(0, 10);

    return NextResponse.json({ opportunities: scored });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
