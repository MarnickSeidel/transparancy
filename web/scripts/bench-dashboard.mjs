import { PrismaClient, Prisma } from "@prisma/client";
import { performance } from "node:perf_hooks";

const prisma = new PrismaClient();
const MIN_ANALYTICS_AREA_M2 = 5;

async function time(label, fn) {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`${label}: ${ms}ms`);
  return { ms, result };
}

async function explain(label, sql) {
  console.log(`\n=== EXPLAIN ANALYZE: ${label} ===`);
  const rows = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}
  `;
  for (const r of rows) console.log(r["QUERY PLAN"]);
}

const whereSql = Prisma.join(
  [
    Prisma.sql`l.is_active = true`,
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
  ],
  " AND ",
);

async function main() {
  const count = await prisma.listing.count();
  console.log(`Total listings: ${count}`);

  await time("summary aggregate avg", () =>
    prisma.listing.aggregate({
      where: {
        isActive: true,
        pricePerM2: { not: null },
        areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      },
      _avg: { pricePerM2: true },
    }),
  );

  await time("summary counts (x5)", async () => {
    const cityWhere = { isActive: true };
    await Promise.all([
      prisma.listing.count({ where: cityWhere }),
      prisma.listing.count({ where: { ...cityWhere, estrato: { not: null } } }),
      prisma.listing.count({
        where: { ...cityWhere, latitude: { not: null }, longitude: { not: null } },
      }),
    ]);
  });

  await time("summary winsorize percentile", () =>
    prisma.$queryRaw(Prisma.sql`
      WITH filtered AS (
        SELECT l.price_per_m2 AS ppm2
        FROM listings l
        WHERE ${whereSql}
      ),
      bounds AS (
        SELECT
          COUNT(*)::bigint AS n,
          percentile_cont(0.02) WITHIN GROUP (ORDER BY ppm2) AS lo,
          percentile_cont(0.98) WITHIN GROUP (ORDER BY ppm2) AS hi
        FROM filtered
      ),
      clipped AS (
        SELECT LEAST(GREATEST(f.ppm2, b.lo), b.hi) AS v
        FROM filtered f
        CROSS JOIN bounds b
        WHERE b.n > 0
      )
      SELECT
        b.n AS n,
        (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p25,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p50,
        (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p75
      FROM bounds b
    `),
  );

  await time("filters groupBy cities", () =>
    prisma.listing.groupBy({ by: ["city"], orderBy: { city: "asc" } }),
  );

  await time("filters groupBy neighborhoods", () =>
    prisma.listing.groupBy({
      by: ["neighborhood"],
      where: { neighborhood: { not: null } },
      _count: { neighborhood: true },
      orderBy: { neighborhood: "asc" },
    }),
  );

  await time("filters all groupBys (6)", async () => {
    await Promise.all([
      prisma.listing.groupBy({ by: ["city"], orderBy: { city: "asc" } }),
      prisma.listing.groupBy({ by: ["department"], orderBy: { department: "asc" } }),
      prisma.listing.groupBy({
        by: ["neighborhood"],
        where: { neighborhood: { not: null } },
        _count: { neighborhood: true },
        orderBy: { neighborhood: "asc" },
      }),
      prisma.listing.groupBy({
        by: ["estrato"],
        where: { estrato: { not: null } },
        orderBy: { estrato: "asc" },
      }),
      prisma.listing.groupBy({
        by: ["propertyType"],
        where: { propertyType: { not: null } },
        orderBy: { propertyType: "asc" },
      }),
      prisma.listing.groupBy({
        by: ["operationType"],
        where: { operationType: { not: null } },
        orderBy: { operationType: "asc" },
      }),
    ]);
  });

  await time("aggregates all queries (5)", async () => {
    await Promise.all([
      prisma.$queryRaw(Prisma.sql`
        WITH filtered AS (
          SELECT l.price_per_m2 AS ppm2 FROM listings l WHERE ${whereSql}
        ),
        bounds AS (
          SELECT COUNT(*)::bigint AS n,
            percentile_cont(0.02) WITHIN GROUP (ORDER BY ppm2) AS lo,
            percentile_cont(0.98) WITHIN GROUP (ORDER BY ppm2) AS hi
          FROM filtered
        ),
        clipped AS (
          SELECT LEAST(GREATEST(f.ppm2, b.lo), b.hi) AS v
          FROM filtered f CROSS JOIN bounds b WHERE b.n > 0
        )
        SELECT b.n,
          (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p25,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p50,
          (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY v) FROM clipped)::float8 AS p75
        FROM bounds b
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT l.property_type AS prop_type, COUNT(*)::bigint AS cnt,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p50,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p75,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area_m2)::float8 AS med_area
        FROM listings l WHERE ${whereSql}
        GROUP BY l.property_type ORDER BY cnt DESC
      `),
      prisma.$queryRaw(Prisma.sql`
        WITH nh AS (
          SELECT NULLIF(TRIM(COALESCE(l.neighborhood, l.neighborhood_raw)), '') AS nh_label, l.price_per_m2
          FROM listings l WHERE ${whereSql}
        ),
        agg AS (
          SELECT nh_label, COUNT(*)::bigint AS cnt,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p25,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p50,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p75
          FROM nh GROUP BY nh_label
        )
        SELECT * FROM agg ORDER BY cnt DESC LIMIT 12
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT l.estrato, l.property_type AS prop_type, COUNT(*)::bigint AS cnt,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS med
        FROM listings l WHERE ${whereSql} AND l.estrato IS NOT NULL
        GROUP BY l.estrato, l.property_type
      `),
      prisma.$queryRaw(Prisma.sql`
        SELECT l.estrato, COUNT(*)::bigint AS cnt,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS med
        FROM listings l WHERE ${whereSql} AND l.estrato IS NOT NULL
        GROUP BY l.estrato ORDER BY cnt DESC LIMIT 1
      `),
    ]);
  });

  await time("monthly trends", () =>
    prisma.$queryRaw(Prisma.sql`
      WITH monthly AS (
        SELECT date_trunc('month', l.date_scraped) AS month, l.price_per_m2
        FROM listings l
        WHERE l.is_active = true
          AND l.price_per_m2 IS NOT NULL
          AND l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}
          AND l.date_scraped >= date_trunc('month', NOW()) - (5 * interval '1 month')
      )
      SELECT month, COUNT(*)::bigint AS sample,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS median_ppm2,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p25_ppm2,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS p75_ppm2
      FROM monthly GROUP BY month ORDER BY month ASC
    `),
  );

  await explain(
    "filters groupBy city",
    Prisma.sql`SELECT city FROM listings GROUP BY city ORDER BY city ASC`,
  );

  await explain(
    "monthly trends (all cities)",
    Prisma.sql`
      WITH monthly AS (
        SELECT date_trunc('month', l.date_scraped) AS month, l.price_per_m2
        FROM listings l
        WHERE l.is_active = true
          AND l.price_per_m2 IS NOT NULL
          AND l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}
          AND l.date_scraped >= date_trunc('month', NOW()) - (5 * interval '1 month')
      )
      SELECT month, COUNT(*)::bigint AS sample,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2)::float8 AS median_ppm2
      FROM monthly GROUP BY month ORDER BY month ASC
    `,
  );

  await explain(
    "summary winsorize (all cities)",
    Prisma.sql`
      WITH filtered AS (
        SELECT l.price_per_m2 AS ppm2 FROM listings l WHERE ${whereSql}
      )
      SELECT COUNT(*) FROM filtered
    `,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
