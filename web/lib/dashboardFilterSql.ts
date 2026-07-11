import { Prisma } from "@prisma/client";

import { MIN_ANALYTICS_AREA_M2 } from "@/lib/analytics";

/** Shared WHERE fragments for dashboard analytics (alias `l`). */
export function listingAnalyticsConditions(
  city: string | null,
  estrato: string | null,
  neighborhood: string | null,
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [
    Prisma.sql`l.is_active = true`,
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
  ];
  if (city && city !== "all") parts.push(Prisma.sql`l.city = ${city}`);
  if (neighborhood && neighborhood !== "all") {
    parts.push(Prisma.sql`l.neighborhood = ${neighborhood}`);
  }
  if (estrato && estrato !== "all") {
    const e = Number.parseInt(estrato, 10);
    if (!Number.isNaN(e)) parts.push(Prisma.sql`l.estrato = ${e}`);
  }
  return parts;
}

export function summaryCityConditions(city: string | null): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [
    Prisma.sql`l.is_active = true`,
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
  ];
  if (city && city !== "all") parts.push(Prisma.sql`l.city = ${city}`);
  return parts;
}
