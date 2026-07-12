import { getZonesForCity } from "@/lib/getZonesIndex";
import { DEFAULT_MIN_ZONE_DATA_POINTS, type PublishableZone } from "@/lib/zones";

export async function getRelatedZones(
  city: string,
  excludeSlug: string,
  limit = 6,
): Promise<PublishableZone[]> {
  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  return data.zones
    .filter((z) => z.slug !== excludeSlug)
    .sort((a, b) => b.dataPointCount - a.dataPointCount)
    .slice(0, limit);
}
