import type { Metadata } from "next";

import ZonesIndex from "@/app/components/ZonesIndex";
import { getZoneCities, getZonesForCity } from "@/lib/getZonesIndex";
import { zonesIndexItemListJsonLd } from "@/lib/citySeo";
import { type Locale, LOCALES } from "@/lib/locale";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
import { zonesIndexMetadata } from "@/lib/zoneSeo";

export const revalidate = 300;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return zonesIndexMetadata(params.locale as Locale);
}

export default async function ZonesPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) return null;

  const cities = await getZoneCities(DEFAULT_MIN_ZONE_DATA_POINTS);
  const initialCity = cities.includes(DEFAULT_ZONE_CITY) ? DEFAULT_ZONE_CITY : cities[0];
  const initialData = await getZonesForCity(initialCity, DEFAULT_MIN_ZONE_DATA_POINTS);
  const jsonLd = zonesIndexItemListJsonLd(cities, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ZonesIndex
        locale={locale}
        initialCities={cities}
        initialCity={initialCity}
        initialData={initialData}
      />
    </>
  );
}
