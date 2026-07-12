import { catalogKeyForCity } from "@/lib/neighborhoodResolver";
import { getDashboardSummary } from "@/lib/dashboardSummary";
import { getZoneCities, getZonesForCity } from "@/lib/getZonesIndex";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
import type { PublishableZone } from "@/lib/zones";

export type HomePageData = {
  totalListings: number;
  neighborhoodCount: number;
  cityCount: number;
  activeListings: number;
  featuredZones: PublishableZone[];
  featuredCities: Array<{ name: string; slug: string; zoneCount: number }>;
};

export async function getHomePageData(): Promise<HomePageData> {
  const [summary, cities] = await Promise.all([
    getDashboardSummary(null),
    getZoneCities(DEFAULT_MIN_ZONE_DATA_POINTS),
  ]);

  const featuredCity = cities.includes(DEFAULT_ZONE_CITY)
    ? DEFAULT_ZONE_CITY
    : cities[0] ?? DEFAULT_ZONE_CITY;

  const zonesData = await getZonesForCity(featuredCity, DEFAULT_MIN_ZONE_DATA_POINTS);
  const featuredZones = [...zonesData.zones]
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 6);

  const featuredCities = await Promise.all(
    cities.slice(0, 8).map(async (name) => {
      const slug =
        catalogKeyForCity(name) ?? name.trim().toLowerCase().replace(/\s+/g, "-");
      const data = await getZonesForCity(name, DEFAULT_MIN_ZONE_DATA_POINTS);
      return { name, slug, zoneCount: data.zones.length };
    }),
  );

  return {
    totalListings: summary.totalListings,
    neighborhoodCount: summary.neighborhoodCount,
    cityCount: summary.cityCount,
    activeListings: summary.activeListings,
    featuredZones,
    featuredCities,
  };
}
