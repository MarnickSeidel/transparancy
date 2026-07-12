import { catalogKeyForCity } from "@/lib/neighborhoodResolver";
import { getZoneCities } from "@/lib/getZonesIndex";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export function cityNameToSlug(city: string): string {
  return catalogKeyForCity(city) ?? city.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function getCityFromSlug(
  citySlug: string,
  minDataPoints = DEFAULT_MIN_ZONE_DATA_POINTS,
): Promise<string | null> {
  const cities = await getZoneCities(minDataPoints);
  for (const city of cities) {
    if (cityNameToSlug(city) === citySlug) return city;
  }
  return null;
}
