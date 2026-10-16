import type { Metadata } from "next";

import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { ogLocale, type Locale } from "@/lib/locale";
import { localeOgImage, ogImageMeta } from "@/lib/ogImages";
import { BRAND_NAME } from "@/lib/brand";
import { pageTitle } from "@/lib/seo";
import { cityNameToSlug } from "@/lib/getCityFromSlug";
import { absoluteUrl } from "@/lib/siteUrl";
import type { PublishableZone } from "@/lib/zones";

export function cityHubPath(citySlug: string): string {
  return `/zones/${encodeURIComponent(citySlug)}`;
}

export function cityHubMetadata(
  city: string,
  citySlug: string,
  zoneCount: number,
  locale: Locale,
): Metadata {
  const path = cityHubPath(citySlug);
  const alt = hreflangAlternates(path);

  if (locale === "en") {
    const title = `${city} neighborhoods — price per m² data | ${BRAND_NAME}`;
    const description = `Market data for ${zoneCount} neighborhoods in ${city}, Colombia. Median price per m², active listings, and trends from Finca Raíz — for local and US investors.`;
    const url = canonicalForLocale(path, locale);
    const ogImage = localeOgImage(locale);
    return {
      title: pageTitle(title),
      description,
      alternates: { canonical: url, languages: alt.languages },
      openGraph: {
        title,
        description,
        url,
        siteName: BRAND_NAME,
        locale: ogLocale(locale),
        type: "website",
        images: [ogImageMeta(ogImage)],
      },
      twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
  }

  const title = `Barrios en ${city} — precio m² por zona | ${BRAND_NAME}`;
  const description = `Datos de mercado para ${zoneCount} barrios en ${city}: mediana de precio/m², publicaciones activas y tendencias basadas en anuncios Finca Raíz.`;
  const ogImage = localeOgImage(locale);
  return {
    title: pageTitle(title),
    description,
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: {
      title,
      description,
      url: alt.canonical,
      siteName: BRAND_NAME,
      locale: ogLocale(locale),
      type: "website",
      images: [ogImageMeta(ogImage)],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export function cityHubJsonLd(
  city: string,
  citySlug: string,
  zones: PublishableZone[],
  locale: Locale,
) {
  const path = cityHubPath(citySlug);
  const url = canonicalForLocale(path, locale);
  const name =
    locale === "en"
      ? `${city} neighborhoods — real estate market data`
      : `Barrios en ${city} — datos de mercado inmobiliario`;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: zones.length,
    itemListElement: zones.slice(0, 50).map((z, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: z.displayName,
      url: absoluteUrl(
        `/zones/${encodeURIComponent(citySlug)}/${encodeURIComponent(z.slug)}`,
      ),
    })),
  };
}

export function zonesIndexItemListJsonLd(
  cities: string[],
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name:
      locale === "en"
        ? "Colombia neighborhood market dossiers"
        : "Dossiers de barrios en Colombia",
    url: canonicalForLocale("/zones", locale),
    numberOfItems: cities.length,
    itemListElement: cities.map((city, i) => {
      const slug = cityNameToSlug(city);
      return {
        "@type": "ListItem",
        position: i + 1,
        name: city,
        url: absoluteUrl(cityHubPath(slug)),
      };
    }),
  };
}
