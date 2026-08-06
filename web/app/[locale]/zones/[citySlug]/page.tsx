import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/app/components/Breadcrumbs";
import CityZoneDirectory from "@/app/components/CityZoneDirectory";
import ZonesPageChrome from "@/app/components/ZonesPageChrome";
import { cityHubJsonLd, cityHubMetadata } from "@/lib/citySeo";
import { getCityFromSlug } from "@/lib/getCityFromSlug";
import { getZonesForCity } from "@/lib/getZonesIndex";
import { cityIntroParagraph } from "@/lib/zoneCopy";
import { breadcrumbJsonLd } from "@/lib/trustSeo";
import { localePath, type Locale, LOCALES } from "@/lib/locale";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export const revalidate = 300;

type Props = { params: { locale: string; citySlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale as Locale;
  const city = await getCityFromSlug(params.citySlug);
  if (!city) return { title: locale === "en" ? "City not found" : "Ciudad no encontrada" };
  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  return cityHubMetadata(city, params.citySlug, data.zones.length, locale);
}

export default async function CityHubPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const city = await getCityFromSlug(params.citySlug);
  if (!city) notFound();

  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  const lp = (path: string) => localePath(locale, path);
  const intro = cityIntroParagraph(city, data.zones.length, locale);

  const crumbs = [
    { label: locale === "en" ? "Home" : "Inicio", href: lp("/") },
    { label: locale === "en" ? "Neighborhoods" : "Barrios", href: lp("/zones") },
    { label: city, href: lp(`/zones/${params.citySlug}`) },
  ];

  const jsonLd = [
    cityHubJsonLd(city, params.citySlug, data.zones, locale),
    breadcrumbJsonLd(
      [
        { name: locale === "en" ? "Home" : "Inicio", path: "/" },
        { name: locale === "en" ? "Neighborhoods" : "Barrios", path: "/zones" },
        { name: city, path: `/zones/${params.citySlug}` },
      ],
      locale,
    ),
  ];

  const h1 =
    locale === "en"
      ? `${city} neighborhoods — price per m²`
      : `Barrios en ${city} — precio m²`;

  return (
    <ZonesPageChrome locale={locale} title={h1} subtitle={intro}>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <Breadcrumbs items={crumbs} lang={locale} />
      <CityZoneDirectory
        zones={data.zones.map((z) => ({
          slug: z.slug,
          displayName: z.displayName,
          listingCount: z.listingCount,
          medianPricePerM2: z.medianPricePerM2,
        }))}
        citySlug={params.citySlug}
        locale={locale}
      />
    </ZonesPageChrome>
  );
}
