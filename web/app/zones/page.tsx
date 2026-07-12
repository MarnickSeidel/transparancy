import type { Metadata } from "next";

import ZonesIndex from "@/app/components/ZonesIndex";
import { getZoneCities, getZonesForCity } from "@/lib/getZonesIndex";
import { zonesIndexMetadata } from "@/lib/zoneSeo";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";

export const metadata: Metadata = zonesIndexMetadata();

export const revalidate = 300;

export default async function ZonesPage() {
  const cities = await getZoneCities(DEFAULT_MIN_ZONE_DATA_POINTS);
  const initialCity = cities.includes(DEFAULT_ZONE_CITY) ? DEFAULT_ZONE_CITY : cities[0];
  const initialData = await getZonesForCity(initialCity, DEFAULT_MIN_ZONE_DATA_POINTS);

  return (
    <ZonesIndex initialCities={cities} initialCity={initialCity} initialData={initialData} />
  );
}
