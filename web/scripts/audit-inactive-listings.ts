import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [totals] = await prisma.$queryRaw<
    Array<{ total: bigint; active: bigint; inactive: bigint }>
  >`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active,
      COUNT(*) FILTER (WHERE is_active = false)::bigint AS inactive
    FROM listings
  `;

  const [likelyAccidental] = await prisma.$queryRaw<
    Array<{ n: bigint }>
  >`
    SELECT COUNT(*)::bigint AS n
    FROM listings
    WHERE is_active = false
      AND times_seen > 1
      AND price_per_m2 IS NOT NULL
      AND area_m2 >= 5
  `;

  const [seenRecentlyButInactive] = await prisma.$queryRaw<
    Array<{ n: bigint }>
  >`
    SELECT COUNT(*)::bigint AS n
    FROM listings
    WHERE is_active = false
      AND last_seen_at >= NOW() - INTERVAL '30 days'
  `;

  const [neverSeenAfterFirst] = await prisma.$queryRaw<
    Array<{ n: bigint }>
  >`
    SELECT COUNT(*)::bigint AS n
    FROM listings
    WHERE is_active = false
      AND times_seen = 1
  `;

  const byCity = await prisma.$queryRaw<
    Array<{ city: string; total: bigint; active: bigint; inactive: bigint }>
  >`
    SELECT
      city,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active,
      COUNT(*) FILTER (WHERE is_active = false)::bigint AS inactive
    FROM listings
    GROUP BY city
    ORDER BY total DESC
    LIMIT 15
  `;

  const inactiveByLastSeen = await prisma.$queryRaw<
    Array<{ bucket: string; n: bigint }>
  >`
    SELECT
      CASE
        WHEN last_seen_at >= NOW() - INTERVAL '7 days' THEN 'last 7d'
        WHEN last_seen_at >= NOW() - INTERVAL '30 days' THEN '8-30d'
        WHEN last_seen_at >= NOW() - INTERVAL '90 days' THEN '31-90d'
        ELSE '90d+'
      END AS bucket,
      COUNT(*)::bigint AS n
    FROM listings
    WHERE is_active = false
    GROUP BY 1
    ORDER BY MIN(last_seen_at) DESC
  `;

  const [dupExternal] = await prisma.$queryRaw<
    Array<{ n: bigint }>
  >`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT external_id FROM listings GROUP BY external_id HAVING COUNT(*) > 1
    ) d
  `;

  console.log("=== LISTING COUNTS ===");
  console.log({
    total: Number(totals.total),
    active: Number(totals.active),
    inactive: Number(totals.inactive),
    dashboardShowsActiveOnly: true,
  });

  console.log("\n=== LIKELY ACCIDENTAL DEACTIVATION PROXIES ===");
  console.log({
    inactiveButSeenMultipleTimes:
      "Listings scraped more than once, then marked inactive — strong bug signal",
    count: Number(likelyAccidental.n),
    inactiveButLastSeenWithin30Days:
      "Inactive yet last_seen recently — may still be on market",
    countRecent: Number(seenRecentlyButInactive.n),
    inactiveOnlySeenOnce:
      "Could be genuinely delisted OR never re-touched after first scrape",
    countOnce: Number(neverSeenAfterFirst.n),
    duplicateExternalIds: Number(dupExternal.n),
  });

  console.log("\n=== INACTIVE BY LAST_SEEN BUCKET ===");
  for (const row of inactiveByLastSeen) {
    console.log(`  ${row.bucket}: ${Number(row.n).toLocaleString()}`);
  }

  console.log("\n=== TOP CITIES (total / active / inactive) ===");
  for (const row of byCity) {
    console.log(
      `  ${row.city}: ${Number(row.total).toLocaleString()} total | ${Number(row.active).toLocaleString()} active | ${Number(row.inactive).toLocaleString()} inactive`,
    );
  }

  const [refined] = await prisma.$queryRaw<
    Array<{
      inactive_once: number;
      inactive_multi: number;
      once_recent: number;
      multi_recent: number;
      inactive_recent_with_price: number;
    }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE is_active = false AND times_seen = 1)::int AS inactive_once,
      COUNT(*) FILTER (WHERE is_active = false AND times_seen > 1)::int AS inactive_multi,
      COUNT(*) FILTER (WHERE is_active = false AND times_seen = 1 AND last_seen_at >= NOW() - INTERVAL '60 days')::int AS once_recent,
      COUNT(*) FILTER (WHERE is_active = false AND times_seen > 1 AND last_seen_at >= NOW() - INTERVAL '60 days')::int AS multi_recent,
      COUNT(*) FILTER (WHERE is_active = false AND last_seen_at >= NOW() - INTERVAL '60 days' AND price_per_m2 IS NOT NULL)::int AS inactive_recent_with_price
    FROM listings
  `;

  console.log("\n=== REFINED ACCIDENTAL ESTIMATE ===");
  console.log(refined);
  console.log(`
Interpretation:
- inactive_multi (${refined.inactive_multi.toLocaleString()}): scraped 2+ times, then deactivated — almost certainly includes bug victims
- once_recent (${refined.once_recent.toLocaleString()}): only 1 scrape, deactivated within 60d — often first refresh skipped touch
- inactive_recent_with_price (${refined.inactive_recent_with_price.toLocaleString()}): good data, seen in last 60d, inactive — upper bound for 'probably should be active'
`);

  const gapFrom110k = 110_000 - Number(totals.total);
  console.log("\n=== vs YOUR ~110k ESTIMATE ===");
  console.log({
    currentTotal: Number(totals.total),
    missingIf110kWasTotalRows: gapFrom110k > 0 ? gapFrom110k : 0,
    note:
      gapFrom110k > 0
        ? "Rows may have been deleted, never imported, or 110k counted something else (e.g. active+inactive at peak, or including duplicates)."
        : "Current total meets or exceeds 110k.",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
