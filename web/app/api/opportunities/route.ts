import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2 } from "@/lib/analytics";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";
import { prisma } from "@/lib/prisma";
import { dealScore } from "@/lib/transparency";

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

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return s / nums.length;
}

type ConfidenceLevel = "high" | "medium" | "low";
type MetricType = "built" | "terrain" | "generic";

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const idx = (arr.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return arr[low];
  const w = idx - low;
  return arr[low] * (1 - w) + arr[high] * w;
}

function areaMismatchGuard(l: {
  propertyType: string | null;
  areaM2: number;
  areaBuiltM2: number | null;
  areaTerrainM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pricePerM2Built: number | null;
  pricePerM2Terrain: number | null;
}, minBuiltPpm2ForHouse: number): boolean {
  const t = (l.propertyType ?? "").toLowerCase();
  const isHouse = t.includes("casa");
  if (!isHouse) return false;

  // Very likely a terrain/built mixup for houses.
  if (l.areaM2 >= 600 && (l.areaBuiltM2 == null || l.areaBuiltM2 < 220)) {
    return true;
  }

  // Unrealistically small built area for houses.
  if (
    l.areaM2 < 25 &&
    (l.areaBuiltM2 == null || l.areaBuiltM2 < 25) &&
    (l.areaTerrainM2 == null || l.areaTerrainM2 < 100)
  ) {
    return true;
  }

  // Contradictory area fields.
  if (
    l.areaBuiltM2 != null &&
    l.areaTerrainM2 != null &&
    l.areaBuiltM2 > l.areaTerrainM2 * 1.5
  ) {
    return true;
  }

  // House-like layout but "built" density is too low for urban houses:
  // usually means lot/total area got treated as built area.
  if (
    l.areaM2 >= 900 &&
    (l.bedrooms ?? 0) <= 6 &&
    (l.bathrooms ?? 0) <= 8 &&
    l.pricePerM2Built != null &&
    l.pricePerM2Built < minBuiltPpm2ForHouse &&
    (l.pricePerM2Terrain == null || l.pricePerM2Terrain <= l.pricePerM2Built * 1.4)
  ) {
    return true;
  }

  return false;
}

function confidenceForListing(l: {
  propertyType: string | null;
  neighborhood: string | null;
  areaM2: number;
  areaBuiltM2: number | null;
  areaTerrainM2: number | null;
  sourceUpdatedAt: Date | null;
}): { confidence: ConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  const t = (l.propertyType ?? "").toLowerCase();
  const isHouse = t.includes("casa");

  if (!l.propertyType) {
    score -= 20;
    reasons.push("missing_property_type");
  }
  if (!l.neighborhood) {
    score -= 15;
    reasons.push("missing_neighborhood");
  }
  if (!l.sourceUpdatedAt) {
    score -= 10;
    reasons.push("missing_update_time");
  } else {
    const ageDays = (Date.now() - l.sourceUpdatedAt.getTime()) / 86400000;
    if (ageDays > 45) {
      score -= 20;
      reasons.push("stale_listing");
    } else if (ageDays > 20) {
      score -= 10;
      reasons.push("aging_listing");
    }
  }
  if (isHouse && l.areaTerrainM2 != null && l.areaBuiltM2 == null && l.areaM2 > 300) {
    score -= 25;
    reasons.push("house_area_terrain_like");
  }
  if (l.areaBuiltM2 != null && l.areaM2 > 0) {
    const ratio = Math.max(l.areaBuiltM2, l.areaM2) / Math.min(l.areaBuiltM2, l.areaM2);
    if (ratio >= 3) {
      score -= 20;
      reasons.push("built_total_area_divergence");
    } else if (ratio >= 2) {
      score -= 10;
      reasons.push("built_total_area_gap");
    }
  }

  if (score >= 80) return { confidence: "high", reasons };
  if (score >= 55) return { confidence: "medium", reasons };
  return { confidence: "low", reasons };
}

function pickMetricForListing(l: {
  propertyType: string | null;
  pricePerM2: number | null;
  pricePerM2Built: number | null;
  pricePerM2Terrain: number | null;
  areaBuiltM2: number | null;
  areaTerrainM2: number | null;
}): { metricType: MetricType; ppm2: number | null } {
  const t = (l.propertyType ?? "").toLowerCase();
  const terrainLike =
    t.includes("lote") ||
    t.includes("terreno") ||
    t.includes("finca") ||
    t.includes("parcela");

  if (
    l.pricePerM2Terrain != null &&
    l.areaTerrainM2 != null &&
    l.areaTerrainM2 >= 50 &&
    terrainLike
  ) {
    return { metricType: "terrain", ppm2: l.pricePerM2Terrain };
  }

  if (
    l.pricePerM2Built != null &&
    l.areaBuiltM2 != null &&
    l.areaBuiltM2 >= 20
  ) {
    return { metricType: "built", ppm2: l.pricePerM2Built };
  }

  if (
    l.pricePerM2Terrain != null &&
    l.areaTerrainM2 != null &&
    l.areaTerrainM2 >= 80
  ) {
    return { metricType: "terrain", ppm2: l.pricePerM2Terrain };
  }

  return { metricType: "generic", ppm2: l.pricePerM2 };
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
        pricePerM2: { not: null },
        areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      },
    ];

    if (maxPriceCop != null) {
      andFilters.push({ priceCop: { lte: maxPriceCop } });
    }

    if (city && city !== "all") andFilters.push({ city });
    if (propertyType && propertyType.trim()) {
      andFilters.push({ propertyType: propertyType.trim() });
    }
    const where: Prisma.ListingWhereInput = { AND: andFilters };

    const rows = await prisma.listing.findMany({
      where,
      orderBy: { dateScraped: "desc" },
      take: 2500,
    });

    const filteredRows = rows.filter((r) =>
      neighborhoodPassesFilters(
        r.neighborhood,
        selectedNeighborhoodKey,
        excludedNeighborhoodKeys,
        excludeUnknownNeighborhoods,
      ),
    );

    const neighborhoodAvgsGeneric = new Map<string, number>();
    const neighborhoodAvgsBuilt = new Map<string, number>();
    const neighborhoodAvgsTerrain = new Map<string, number>();
    const genericBuckets = new Map<string, number[]>();
    const builtBuckets = new Map<string, number[]>();
    const terrainBuckets = new Map<string, number[]>();
    for (const r of filteredRows) {
      const key = normalizeNeighborhoodKey(r.neighborhood ?? "");
      if (!key) continue;
      if (r.pricePerM2 != null) {
        const arr = genericBuckets.get(key) ?? [];
        arr.push(r.pricePerM2);
        genericBuckets.set(key, arr);
      }
      if (r.pricePerM2Built != null) {
        const arr = builtBuckets.get(key) ?? [];
        arr.push(r.pricePerM2Built);
        builtBuckets.set(key, arr);
      }
      if (r.pricePerM2Terrain != null) {
        const arr = terrainBuckets.get(key) ?? [];
        arr.push(r.pricePerM2Terrain);
        terrainBuckets.set(key, arr);
      }
    }
    Array.from(genericBuckets.entries()).forEach(([k, vals]) => {
      const a = avg(vals);
      if (a != null) neighborhoodAvgsGeneric.set(k, a);
    });
    Array.from(builtBuckets.entries()).forEach(([k, vals]) => {
      const a = avg(vals);
      if (a != null) neighborhoodAvgsBuilt.set(k, a);
    });
    Array.from(terrainBuckets.entries()).forEach(([k, vals]) => {
      const a = avg(vals);
      if (a != null) neighborhoodAvgsTerrain.set(k, a);
    });
    const cityAvgGeneric = avg(
      filteredRows
        .map((r) => r.pricePerM2)
        .filter((v): v is number => v != null && Number.isFinite(v)),
    );
    const cityAvgBuilt = avg(
      filteredRows
        .map((r) => r.pricePerM2Built)
        .filter((v): v is number => v != null && Number.isFinite(v)),
    );
    const cityAvgTerrain = avg(
      filteredRows
        .map((r) => r.pricePerM2Terrain)
        .filter((v): v is number => v != null && Number.isFinite(v)),
    );

    const builtHousePpm2 = filteredRows
      .filter((l) => (l.propertyType ?? "").toLowerCase().includes("casa"))
      .map((l) => l.pricePerM2Built)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    const p15BuiltHouse = percentile(builtHousePpm2, 0.15);
    // City-aware floor: never below fixed baseline, but scales up in higher-price cities.
    const minBuiltPpm2ForHouse =
      p15BuiltHouse != null
        ? Math.max(900000, p15BuiltHouse * 0.75)
        : 900000;

    const top10 = filteredRows
      .filter((l) => !areaMismatchGuard(l, minBuiltPpm2ForHouse))
      .map((l) => {
        const picked = pickMetricForListing(l);
        const ppm2 = picked.ppm2;
        const neighborhoodKey = normalizeNeighborhoodKey(l.neighborhood ?? "");
        const refFrom = (m: Map<string, number>, cityAvg: number | null | undefined) => {
          if (!neighborhoodKey) return cityAvg ?? null;
          return m.get(neighborhoodKey) ?? cityAvg ?? null;
        };
        const ref =
          picked.metricType === "built"
            ? refFrom(neighborhoodAvgsBuilt, cityAvgBuilt)
            : picked.metricType === "terrain"
              ? refFrom(neighborhoodAvgsTerrain, cityAvgTerrain)
              : refFrom(neighborhoodAvgsGeneric, cityAvgGeneric);
        const score =
          l.dealScore ??
          dealScore(ppm2, ref, l.sourceUpdatedAt, l.dataCompletenessScore);
        const { confidence, reasons } = confidenceForListing(l);
        const gapPct =
          ppm2 != null && ref != null && ref > 0 ? ((ref - ppm2) / ref) * 100 : null;
        return {
          id: l.id,
          title: l.title,
          city: l.city,
          neighborhood: l.neighborhood,
          priceCop: l.priceCop.toString(),
          areaM2: l.areaM2,
          pricePerM2: ppm2,
          metricType: picked.metricType,
          refAvgUsed: ref,
          dealScore: score,
          confidence,
          confidenceReasons: reasons,
          discountVsRefPct: gapPct,
          url: l.url,
          imageUrl: l.imageUrl,
          sourceUpdatedAt: l.sourceUpdatedAt?.toISOString() ?? null,
        };
      })
      .filter((r) => r.pricePerM2 != null && r.refAvgUsed != null)
      .filter((r) => !hideLowConfidence || r.confidence !== "low")
      .sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1))
      .slice(0, 10);

    return NextResponse.json({ opportunities: top10 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
