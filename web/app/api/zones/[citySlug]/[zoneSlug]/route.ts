import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import {
  bucketKeyFromSlug,
  citySlugFromBucketKey,
  mapRawZoneRow,
  parseMinCount,
  sqlBucketKey,
  sqlEffectivePpm2,
  zoneSlugFromBucketKey,
  type ZoneAlias,
  type ZoneDossier,
  type ZoneMonthlyTrend,
  type ZonePropertyTypeStat,
} from "@/lib/zones";

export const dynamic = "force-dynamic";

type RouteContext = { params: { citySlug: string; zoneSlug: string } };

export async function GET(req: Request, { params }: RouteContext) {
  const { citySlug, zoneSlug } = params;
  const { searchParams } = new URL(req.url);
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );
  const bucketKey = bucketKeyFromSlug(citySlug, zoneSlug);

  try {
    const summaryRows = await prisma.$queryRaw<
      Array<{
        bucket_key: string;
        city: string;
        display_name: string | null;
        listing_count: bigint;
        data_point_count: bigint;
        median_ppm2: number | null;
        median_price_cop: number | null;
        catalog_count: bigint;
        source_id_count: bigint;
        provisional_count: bigint;
        weak_count: bigint;
        missing_count: bigint;
      }>
    >(Prisma.sql`
      WITH tagged AS (
        SELECT
          ${sqlBucketKey()} AS bucket_key,
          l.city,
          l.neighborhood,
          l.price_cop::float8 AS price_cop,
          ${sqlEffectivePpm2()} AS ppm2,
          COALESCE(l.quality_flags->>'neighborhood_confidence', 'missing') AS confidence
        FROM listings l
        WHERE l.is_active = true
      ),
      bucket AS (
        SELECT * FROM tagged WHERE bucket_key = ${bucketKey}
      )
      SELECT
        bucket_key,
        MAX(city) AS city,
        MODE() WITHIN GROUP (ORDER BY neighborhood) AS display_name,
        COUNT(*)::bigint AS listing_count,
        COUNT(*) FILTER (WHERE ppm2 IS NOT NULL)::bigint AS data_point_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ppm2)
          FILTER (WHERE ppm2 IS NOT NULL)::float8 AS median_ppm2,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cop)::float8 AS median_price_cop,
        COUNT(*) FILTER (WHERE confidence = 'catalog')::bigint AS catalog_count,
        COUNT(*) FILTER (WHERE confidence = 'source_id')::bigint AS source_id_count,
        COUNT(*) FILTER (WHERE confidence = 'provisional')::bigint AS provisional_count,
        COUNT(*) FILTER (WHERE confidence = 'weak')::bigint AS weak_count,
        COUNT(*) FILTER (WHERE confidence = 'missing')::bigint AS missing_count
      FROM bucket
      GROUP BY bucket_key
    `);

    const summary = summaryRows[0];
    if (!summary || Number(summary.data_point_count) < minDataPoints) {
      return NextResponse.json(
        { error: "Zone not found or below publish threshold." },
        { status: 404 },
      );
    }

    if (citySlugFromBucketKey(summary.bucket_key) !== citySlug) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }

    if (zoneSlugFromBucketKey(summary.bucket_key) !== zoneSlug) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }

    const exploreNeighborhood = summary.display_name?.trim() || zoneSlug;

    const [aliasRows, typeRows, trendRows] = await Promise.all([
      prisma.$queryRaw<Array<{ label: string; count: bigint }>>(Prisma.sql`
        SELECT
          btrim(l.neighborhood_raw) AS label,
          COUNT(*)::bigint AS count
        FROM listings l
        WHERE l.is_active = true
          AND ${sqlBucketKey()} = ${bucketKey}
          AND l.neighborhood_raw IS NOT NULL
          AND btrim(l.neighborhood_raw) <> ''
        GROUP BY btrim(l.neighborhood_raw)
        ORDER BY COUNT(*) DESC, label ASC
        LIMIT 12
      `),
      prisma.$queryRaw<
        Array<{
          property_type: string;
          count: bigint;
          median_ppm2: number | null;
        }>
      >(Prisma.sql`
        SELECT
          COALESCE(NULLIF(btrim(l.property_type), ''), 'Unknown') AS property_type,
          COUNT(*)::bigint AS count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY ${sqlEffectivePpm2()})
            FILTER (WHERE ${sqlEffectivePpm2()} IS NOT NULL)::float8 AS median_ppm2
        FROM listings l
        WHERE l.is_active = true
          AND ${sqlBucketKey()} = ${bucketKey}
        GROUP BY COALESCE(NULLIF(btrim(l.property_type), ''), 'Unknown')
        ORDER BY COUNT(*) DESC, property_type ASC
      `),
      prisma.$queryRaw<
        Array<{
          month: Date;
          sample: bigint;
          median_ppm2: number | null;
        }>
      >(Prisma.sql`
        WITH monthly AS (
          SELECT
            date_trunc('month', l.date_scraped) AS month,
            ${sqlEffectivePpm2()} AS ppm2
          FROM listings l
          WHERE l.is_active = true
            AND ${sqlBucketKey()} = ${bucketKey}
            AND ${sqlEffectivePpm2()} IS NOT NULL
            AND l.date_scraped >= date_trunc('month', NOW()) - interval '11 months'
        )
        SELECT
          month,
          COUNT(*)::bigint AS sample,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY ppm2)::float8 AS median_ppm2
        FROM monthly
        GROUP BY month
        ORDER BY month ASC
      `),
    ]);

    const aliases: ZoneAlias[] = aliasRows
      .map((row) => ({
        label: row.label,
        count: Number(row.count),
      }))
      .filter((row) => row.label.toLowerCase() !== exploreNeighborhood.toLowerCase());

    const propertyTypes: ZonePropertyTypeStat[] = typeRows.map((row) => ({
      type: row.property_type,
      count: Number(row.count),
      medianPricePerM2: row.median_ppm2,
    }));

    const monthlyTrend: ZoneMonthlyTrend[] = trendRows
      .map((row) => ({
        month: row.month.toISOString().slice(0, 7),
        sample: Number(row.sample),
        medianPpm2: row.median_ppm2,
      }))
      .filter((row) => row.sample >= MIN_SAMPLE_SIZE);

    const base = mapRawZoneRow(summary, citySlug);
    const dossier: ZoneDossier = {
      ...base,
      medianPriceCop: summary.median_price_cop,
      propertyTypes,
      aliases,
      exploreNeighborhood,
      monthlyTrend,
    };

    return NextResponse.json(dossier);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}
