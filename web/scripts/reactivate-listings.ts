import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const [before] = await prisma.$queryRaw<
    Array<{ active: bigint; inactive: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active,
      COUNT(*) FILTER (WHERE is_active = false)::bigint AS inactive
    FROM listings
  `;

  const [candidates] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM listings
    WHERE is_active = false
      AND price_per_m2 IS NOT NULL
      AND area_m2 >= 5
      AND last_seen_at >= NOW() - (90 * interval '1 day')
      AND (times_seen > 1 OR last_seen_at >= NOW() - INTERVAL '60 days')
  `;

  console.log("Before:", {
    active: Number(before.active),
    inactive: Number(before.inactive),
  });
  console.log("Candidates:", Number(candidates.n));

  if (!apply) {
    console.log("Dry-run only. Pass --apply to reactivate.");
    return;
  }

  const updated = await prisma.$executeRaw`
    UPDATE listings
    SET is_active = true
    WHERE is_active = false
      AND price_per_m2 IS NOT NULL
      AND area_m2 >= 5
      AND last_seen_at >= NOW() - (90 * interval '1 day')
      AND (times_seen > 1 OR last_seen_at >= NOW() - INTERVAL '60 days')
  `;

  const [after] = await prisma.$queryRaw<
    Array<{ active: bigint; inactive: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE is_active = true)::bigint AS active,
      COUNT(*) FILTER (WHERE is_active = false)::bigint AS inactive
    FROM listings
  `;

  console.log("Reactivated rows:", updated);
  console.log("After:", {
    active: Number(after.active),
    inactive: Number(after.inactive),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
