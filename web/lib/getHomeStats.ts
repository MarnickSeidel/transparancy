import type { OpportunityRow } from "@/lib/getTopOpportunities";
import { getGlobalDataFreshness } from "@/lib/getDataFreshness";
import { DEFAULT_OPPORTUNITIES_CITY } from "@/lib/getTopOpportunities";
import { getCachedDashboardSummary, getCachedTopOpportunities } from "@/lib/serverCache";
import { getZoneCities, getZoneCountsByCity, getZonesForCity } from "@/lib/getZonesIndex";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
import type { PublishableZone } from "@/lib/zones";

export type HomePageData = {
  totalListings: number;
  neighborhoodCount: number;
  cityCount: number;
  activeListings: number;
  lastScrapedAt: string | null;
  featuredZones: PublishableZone[];
  featuredCities: Array<{ name: string; slug: string; zoneCount: number }>;
  featuredOpportunities: OpportunityRow[];
};

export async function getHomePageData(): Promise<HomePageData> {
  const [summary, cities, featuredOpportunitiesResult, freshness] = await Promise.all([
    getCachedDashboardSummary(null),
    getZoneCities(DEFAULT_MIN_ZONE_DATA_POINTS),
    getCachedTopOpportunities({
      city: DEFAULT_OPPORTUNITIES_CITY,
      pageSize: 3,
      hideLowConfidence: true,
    }),
    getGlobalDataFreshness(),
  ]);

  const featuredCity = cities.includes(DEFAULT_ZONE_CITY)
    ? DEFAULT_ZONE_CITY
    : cities[0] ?? DEFAULT_ZONE_CITY;

  const [zonesData, featuredCities] = await Promise.all([
    getZonesForCity(featuredCity, DEFAULT_MIN_ZONE_DATA_POINTS),
    getZoneCountsByCity(DEFAULT_MIN_ZONE_DATA_POINTS),
  ]);

  const featuredZones = [...zonesData.zones]
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 6);

  return {
    totalListings: summary.totalListings,
    neighborhoodCount: summary.neighborhoodCount,
    cityCount: summary.cityCount,
    activeListings: summary.activeListings,
    lastScrapedAt: freshness.lastScrapedAt?.toISOString() ?? null,
    featuredZones,
    featuredCities: featuredCities.slice(0, 8),
    featuredOpportunities: featuredOpportunitiesResult.items,
  };
}
