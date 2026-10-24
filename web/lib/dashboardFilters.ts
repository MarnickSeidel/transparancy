import { MIN_CITY_ACTIVE_LISTINGS } from "@/lib/getFiltersData";
import { priorityCities } from "@/lib/i18n";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";
import { prisma } from "@/lib/prisma";

export type DashboardFiltersData = {
  cities: string[];
  neighborhoods: string[];
  estratos: number[];
};

/** Lightweight filter options for the dashboard (active listings only). */
export async function getDashboardFilters(
  city: string | null,
): Promise<DashboardFiltersData> {
  const baseWhere =
    city && city !== "all"
      ? { isActive: true, city }
      : { isActive: true };

  const [cityRows, neighborhoodRows, estratoRows] = await Promise.all([
    prisma.listing.groupBy({
      by: ["city"],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: { city: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["neighborhood"],
      where: { ...baseWhere, neighborhood: { not: null } },
      _count: { neighborhood: true },
      orderBy: { neighborhood: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["estrato"],
      where: { ...baseWhere, estrato: { not: null } },
      orderBy: { estrato: "asc" },
    }),
  ]);

  const rank = new Map(
    priorityCities.map((name, idx) => [name.toLowerCase(), idx]),
  );
  const detectedCities = cityRows
    .filter((r) => r._count._all >= MIN_CITY_ACTIVE_LISTINGS)
    .map((r) => r.city)
    .filter((c): c is string => c != null && c.trim().length > 0);
  const cities = [...detectedCities].sort((a, b) => {
    const ra = rank.get(a.trim().toLowerCase());
    const rb = rank.get(b.trim().toLowerCase());
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b);
  });

  const neighborhoodBuckets = new Map<string, { label: string; count: number }>();
  for (const row of neighborhoodRows) {
    const raw = row.neighborhood?.trim();
    if (!raw) continue;
    const key = normalizeNeighborhoodKey(raw);
    if (!key) continue;
    const prev = neighborhoodBuckets.get(key);
    const count = row._count?.neighborhood ?? 1;
    if (!prev || count > prev.count) {
      neighborhoodBuckets.set(key, { label: raw, count });
    }
  }
  const neighborhoods = Array.from(neighborhoodBuckets.values())
    .map((b) => b.label)
    .sort((a, b) => a.localeCompare(b));

  const estratos = estratoRows
    .map((r) => r.estrato)
    .filter((e): e is number => e != null);

  return { cities, neighborhoods, estratos };
}
