import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { pricePerM2Bucket, type PriceBucket } from "@/lib/mapPriceBuckets";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const maxPriceRaw = searchParams.get("maxPriceCop");

  if (city && city !== "all") where.city = city;
  if (propertyType && propertyType !== "all") where.propertyType = propertyType;
  if (estrato && estrato !== "all") {
    const e = Number.parseInt(estrato, 10);
    if (!Number.isNaN(e)) where.estrato = e;
  }

  const maxPrice = maxPriceRaw ? Number.parseInt(maxPriceRaw.replace(/\D/g, ""), 10) : Number.NaN;
  if (Number.isFinite(maxPrice) && maxPrice >= 1) {
    where.priceCop = { lte: BigInt(maxPrice) };
  }

  return where;
}

async function applyNeighborhoodFilter(
  where: Prisma.ListingWhereInput,
  neighborhood: string | null,
): Promise<void> {
  if (!neighborhood || neighborhood === "all") return;

  const key = normalizeNeighborhoodKey(neighborhood.trim());
  if (!key) {
    where.neighborhood = neighborhood;
    return;
  }

  const city =
    typeof where.city === "string"
      ? where.city
      : undefined;

  const rows = await prisma.listing.findMany({
    where: {
      isActive: true,
      ...(city ? { city } : {}),
      neighborhood: { not: null },
    },
    select: { neighborhood: true },
    distinct: ["neighborhood"],
  });

  const matches = rows
    .map((r) => r.neighborhood)
    .filter((n): n is string => !!n && normalizeNeighborhoodKey(n) === key);

  if (matches.length === 0) {
    where.neighborhood = neighborhood;
  } else if (matches.length === 1) {
    where.neighborhood = matches[0];
  } else {
    where.neighborhood = { in: matches };
  }
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
          propertyType: true,
          estrato: true,
          priceCop: true,
          areaM2: true,
          pricePerM2: true,
          url: true,
          imageUrl: true,
          dateScraped: true,
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
        propertyType: row.propertyType,
        estrato: row.estrato,
        priceCop: row.priceCop.toString(),
        areaM2: row.areaM2,
        pricePerM2: ppm2,
        url: row.url,
        imageUrl: row.imageUrl,
        dateScraped: row.dateScraped.toISOString(),
        priceBucket,
        refMedian,
        deltaVsRefPct,
      };
    });

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      listings,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  }
}
