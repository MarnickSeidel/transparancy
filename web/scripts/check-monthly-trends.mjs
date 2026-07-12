import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const snapshots = await prisma.$queryRaw`
  SELECT month, sample, median_ppm2
  FROM monthly_market_snapshots
  WHERE city = 'Pereira'
  ORDER BY month DESC
  LIMIT 8
`;
console.log("Pereira snapshots:", snapshots);

const byMonth = await prisma.$queryRaw`
  SELECT date_trunc('month', COALESCE(source_created_at, first_seen_at))::date AS m,
         COUNT(*)::int AS n
  FROM listings
  WHERE city = 'Pereira' AND price_per_m2 IS NOT NULL AND area_m2 >= 5
  GROUP BY 1 ORDER BY 1 DESC LIMIT 8
`;
console.log("Listings by market start month:", byMonth);

await prisma.$disconnect();
