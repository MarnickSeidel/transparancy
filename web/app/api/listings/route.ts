import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { domDaysFromFirstSeen } from "@/lib/formatDom";
import { pricePerM2Bucket, type PriceBucket } from "@/lib/mapPriceBuckets";
import { resolveNeighborhoodFilter } from "@/lib/neighborhoodAliases";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rateLimit";
import { resolveConjuntoVariants } from "@/lib/resolveConjuntoVariants";

function parseOptionalInt(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function parseOptionalFloat(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function applyGeoBBox(
  where: Prisma.ListingWhereInput,
  lat: number,
  lng: number,
  radiusM: number,
): void {
  const latDelta = radiusM / 111_320;
  const lngDelta =
    radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const geoClause: Prisma.ListingWhereInput = {
    latitude: { not: null, gte: lat - latDelta, lte: lat + latDelta },
    longitude: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
  };
  if (Array.isArray(where.AND)) {
    where.AND.push(geoClause);
  } else if (where.AND) {
    where.AND = [where.AND, geoClause];
  } else {
    where.AND = [geoClause];
  }
}

export const revalidate = 60;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

type RefStats = {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  n: number;
};

function parsePositiveInt(raw: string | null, fallback: number, max: number) {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function buildWhere(searchParams: URLSearchParams): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {
    isActive: true,
    pricePerM2: { not: null },
    areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
  };

  const city = searchParams.get("city");
  const estrato = searchParams.get("estrato");
  const propertyType = searchParams.get("propertyType");
  const minPriceRaw = searchParams.get("minPriceCop");
  const maxPriceRaw = searchParams.get("maxPriceCop");
  const minArea = parseOptionalInt(searchParams.get("minAreaM2"));
  const maxArea = parseOptionalInt(searchParams.get("maxAreaM2"));

  if (city && city !== "all") where.city = city;
  if (propertyType && propertyType !== "all") where.propertyType = propertyType;
  if (estrato && estrato !== "all") {
    const e = Number.parseInt(estrato, 10);
    if (!Number.isNaN(e)) where.estrato = e;
  }

  const minPrice = parseOptionalInt(minPriceRaw);
  const maxPrice = parseOptionalInt(maxPriceRaw);
  if (minPrice != null || maxPrice != null) {
    where.priceCop = {
      ...(minPrice != null ? { gte: BigInt(minPrice) } : {}),
      ...(maxPrice != null ? { lte: BigInt(maxPrice) } : {}),
    };
  }

  if (minArea != null || maxArea != null) {
    where.areaM2 = {
      ...(minArea != null ? { gte: Math.max(MIN_ANALYTICS_AREA_M2, minArea) } : { gte: MIN_ANALYTICS_AREA_M2 }),
      ...(maxArea != null ? { lte: maxArea } : {}),
    };
  }

  const lat = parseOptionalFloat(searchParams.get("latitude"));
  const lng = parseOptionalFloat(searchParams.get("longitude"));
  const radiusM = parseOptionalInt(searchParams.get("radiusMeters"));
  if (lat != null && lng != null && radiusM != null) {
    applyGeoBBox(where, lat, lng, radiusM);
  }

  return where;
}

async function applyConjuntoFilter(
  where: Prisma.ListingWhereInput,
  conjunto: string | null,
  city: string | null,
): Promise<void> {
  if (!conjunto?.trim()) return;

  const cityName =
    city && city !== "all"
      ? city
      : typeof where.city === "string"
        ? where.city
        : null;

  if (!cityName) {
    where.conjunto = conjunto.trim();
    return;
  }

  const variants = await resolveConjuntoVariants(cityName, conjunto);
  if (variants.length > 1) {
    where.conjunto = { in: variants };
    return;
  }
  where.conjunto = variants[0] ?? conjunto.trim();
}

async function applyNeighborhoodFilter(
  where: Prisma.ListingWhereInput,
  neighborhood: string | null,
): Promise<void> {
  if (!neighborhood || neighborhood === "all") return;

  const city =
    typeof where.city === "string"
      ? where.city
      : undefined;

  const resolved = await resolveNeighborhoodFilter(neighborhood, city);
  where.neighborhood = resolved;
}

function buildOrderBy(
  sortBy: string | null,
  sortDir: string | null,
): Prisma.ListingOrderByWithRelationInput {
  const dir = sortDir === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "price":
      return { priceCop: dir };
    case "pricePerM2":
      return { pricePerM2: dir };
    case "area":
      return { areaM2: dir };
    case "dealScore":
      return { dealScore: dir };
    case "title":
      return { title: dir };
    default:
      return { dateScraped: "desc" };
  }
}

function refKey(city: string, neighborhood: string | null) {
  return `${city}::${neighborhood ?? ""}`;
}

function pickRef(
  city: string,
  neighborhood: string | null,
  neighborhoodRefs: Map<string, RefStats>,
  cityRefs: Map<string, RefStats>,
): RefStats | null {
  const nbKey = refKey(city, neighborhood);
  const nbRef = neighborhoodRefs.get(nbKey);
  if (nbRef && nbRef.n >= MIN_SAMPLE_SIZE) return nbRef;

  const cityRef = cityRefs.get(city);
  if (cityRef && cityRef.n >= MIN_SAMPLE_SIZE) return cityRef;
  return nbRef ?? cityRef ?? null;
}

export async function GET(req: Request) {
  const limited = enforceRateLimit(req, "listings", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const page = parsePositiveInt(searchParams.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * pageSize;

  try {
    const where = buildWhere(searchParams);
    await applyNeighborhoodFilter(where, searchParams.get("neighborhood"));
    await applyConjuntoFilter(
      where,
      searchParams.get("conjunto"),
      searchParams.get("city"),
    );
    const orderBy = buildOrderBy(
      searchParams.get("sortBy"),
      searchParams.get("sortDir"),
    );

    const [total, rows] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          city: true,
          neighborhood: true,
          neighborhoodRaw: true,
          propertyType: true,
          estrato: true,
          priceCop: true,
          areaM2: true,
          pricePerM2: true,
          dealScore: true,
          url: true,
          imageUrl: true,
          dateScraped: true,
          firstSeenAt: true,
        },
      }),
    ]);

    const neighborhoodPairs = new Map<string, { city: string; neighborhood: string }>();
    const cities = new Set<string>();
    for (const row of rows) {
      cities.add(row.city);
      if (row.neighborhood?.trim()) {
        const key = refKey(row.city, row.neighborhood);
        neighborhoodPairs.set(key, {
          city: row.city,
          neighborhood: row.neighborhood,
        });
      }
    }

    const neighborhoodRefs = new Map<string, RefStats>();
    if (neighborhoodPairs.size > 0) {
      const pairs = Array.from(neighborhoodPairs.values());
      const stats = await prisma.$queryRaw<
        Array<{
          city: string;
          neighborhood: string;
          n: bigint;
          p25: number | null;
          p50: number | null;
          p75: number | null;
        }>
      >`
        SELECT
          l.city,
          l.neighborhood,
          COUNT(*)::bigint AS n,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p75
        FROM listings l
        WHERE l.price_per_m2 IS NOT NULL
          AND l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}
          AND (l.city, l.neighborhood) IN (
            ${Prisma.join(
              pairs.map((p) => Prisma.sql`(${p.city}, ${p.neighborhood})`),
            )}
          )
        GROUP BY l.city, l.neighborhood
      `;
      for (const s of stats) {
        neighborhoodRefs.set(refKey(s.city, s.neighborhood), {
          n: Number(s.n),
          p25: s.p25,
          p50: s.p50,
          p75: s.p75,
        });
      }
    }

    const cityRefs = new Map<string, RefStats>();
    if (cities.size > 0) {
      const cityList = Array.from(cities);
      const stats = await prisma.$queryRaw<
        Array<{
          city: string;
          n: bigint;
          p25: number | null;
          p50: number | null;
          p75: number | null;
        }>
      >`
        SELECT
          l.city,
          COUNT(*)::bigint AS n,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p75
        FROM listings l
        WHERE l.price_per_m2 IS NOT NULL
          AND l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}
          AND l.city IN (${Prisma.join(cityList)})
        GROUP BY l.city
      `;
      for (const s of stats) {
        cityRefs.set(s.city, {
          n: Number(s.n),
          p25: s.p25,
          p50: s.p50,
          p75: s.p75,
        });
      }
    }

    const listings = rows.map((row) => {
      const ppm2 = row.pricePerM2;
      const ref = pickRef(row.city, row.neighborhood, neighborhoodRefs, cityRefs);
      let priceBucket: PriceBucket | null = null;
      let deltaVsRefPct: number | null = null;
      let refMedian: number | null = null;

      if (ppm2 != null && ref) {
        refMedian = ref.p50;
        priceBucket = pricePerM2Bucket(ppm2, ref.p25, ref.p50, ref.p75);
        if (refMedian != null && refMedian > 0) {
          deltaVsRefPct = ((refMedian - ppm2) / refMedian) * 100;
        }
      }

      return {
        id: row.id,
        title: row.title,
        city: row.city,
        neighborhood: row.neighborhood,
        neighborhoodRaw: row.neighborhoodRaw,
        propertyType: row.propertyType,
        estrato: row.estrato,
        priceCop: row.priceCop.toString(),
        areaM2: row.areaM2,
        pricePerM2: ppm2,
        dealScore: row.dealScore,
        url: row.url,
        imageUrl: row.imageUrl,
        dateScraped: row.dateScraped.toISOString(),
        domDays: domDaysFromFirstSeen(row.firstSeenAt),
        priceBucket,
        refMedian,
        deltaVsRefPct,
      };
    });

    return NextResponse.json(
      {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        listings,
      },
      { headers: CACHE_HEADERS },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
