import type { OpportunityRow } from "@/lib/getTopOpportunities";
import { isFeaturableDeal } from "@/lib/dealReview";
import { getGlobalDataFreshness } from "@/lib/getDataFreshness";
import { DEFAULT_OPPORTUNITIES_CITY } from "@/lib/getTopOpportunities";
import { getCachedDashboardSummary, getCachedTopOpportunities } from "@/lib/serverCache";
import { getZoneCities, getZoneCountsByCity, getZonesForCity } from "@/lib/getZonesIndex";
import { cityNameToSlug } from "@/lib/getCityFromSlug";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
import type { PublishableZone } from "@/lib/zones";

const HOME_FEATURED_COUNT = 3;
/** Ranked candidates to scan for clean, photographed, matched-barrio deals. */
const HOME_CANDIDATE_POOL = 40;

export type HomePageData = {
  totalListings: number;
  neighborhoodCount: number;
  cityCount: number;
  activeListings: number;
  lastScrapedAt: string | null;
  featuredCity: string;
  featuredCitySlug: string;
  featuredZones: PublishableZone[];
  featuredCities: Array<{ name: string; slug: string; zoneCount: number }>;
  featuredOpportunities: OpportunityRow[];
};

export async function getHomePageData(preferredCity?: string): Promise<HomePageData> {
  const requested =
    preferredCity?.trim() || DEFAULT_OPPORTUNITIES_CITY || DEFAULT_ZONE_CITY;

  const [summary, cities, freshness] = await Promise.all([
    getCachedDashboardSummary(null),
    getZoneCities(DEFAULT_MIN_ZONE_DATA_POINTS),
    getGlobalDataFreshness(),
  ]);

  const featuredCity = cities.includes(requested)
    ? requested
    : cities.includes(DEFAULT_ZONE_CITY)
      ? DEFAULT_ZONE_CITY
      : cities[0] ?? DEFAULT_ZONE_CITY;

  const [featuredOpportunitiesResult, zonesData, featuredCities] = await Promise.all([
    getCachedTopOpportunities({
      city: featuredCity,
      pageSize: HOME_CANDIDATE_POOL,
      hideLowConfidence: true,
    }),
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
    featuredCity,
    featuredCitySlug: cityNameToSlug(featuredCity),
    featuredZones,
    featuredCities: featuredCities.slice(0, 8),
    featuredOpportunities: featuredOpportunitiesResult.items
      .filter(isFeaturableDeal)
      .slice(0, HOME_FEATURED_COUNT),
  };
}
