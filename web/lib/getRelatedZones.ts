import { getZonesForCity } from "@/lib/getZonesIndex";
import { DEFAULT_MIN_ZONE_DATA_POINTS, type PublishableZone } from "@/lib/zones";

export async function getRelatedZones(
  city: string,
  excludeSlug: string,
  limit = 6,
): Promise<PublishableZone[]> {
  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  const nameKey = (z: PublishableZone) => z.displayName.trim().toLowerCase();
  const current = data.zones.find((z) => z.slug === excludeSlug);
  // Several buckets can share a display name; show each name once and never the current one.
  const seen = new Set<string>(current ? [nameKey(current)] : []);
  return data.zones
    .filter((z) => z.slug !== excludeSlug)
    .sort((a, b) => b.dataPointCount - a.dataPointCount)
    .filter((z) => {
      const key = nameKey(z);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
