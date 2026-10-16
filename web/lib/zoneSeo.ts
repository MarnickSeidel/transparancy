import type { Metadata } from "next";

import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { localePath, ogLocale, type Locale } from "@/lib/locale";
import { ogImageMeta, zoneOgImage } from "@/lib/ogImages";
import { BRAND_NAME } from "@/lib/brand";
import { pageTitle } from "@/lib/seo";
import { absoluteUrl } from "@/lib/siteUrl";
import type { ZoneDossier } from "@/lib/zones";

function fmtCopShort(v: number | null | undefined, locale: Locale): string {
  if (v == null || Number.isNaN(v)) return "";
  const loc = locale === "es" ? "es-CO" : "en-US";
  return `$${Math.round(v).toLocaleString(loc)}`;
}

export function zonePagePath(dossier: Pick<ZoneDossier, "citySlug" | "slug">): string {
  return `/zones/${encodeURIComponent(dossier.citySlug)}/${encodeURIComponent(dossier.slug)}`;
}

export function zonePageMetadata(dossier: ZoneDossier, locale: Locale = "es"): Metadata {
  const { displayName, city, published } = dossier;
  const path = zonePagePath(dossier);
  const alt = hreflangAlternates(path);
  const ppm2 = fmtCopShort(dossier.medianPricePerM2, locale);

  let title: string;
  let description: string;

  if (locale === "en") {
    title = `${displayName}, ${city} — Price per m² | ${BRAND_NAME}`;
    description = ppm2
      ? `Median asking price per m² in ${displayName}, ${city}: ${ppm2} COP. ${dossier.listingCount.toLocaleString("en-US")} active listings, ${dossier.opportunityCount} opportunities flagged. Finca Raíz data for US and international investors.`
      : `Real estate market dossier for ${displayName}, ${city}, Colombia: active listings, median price/m², and monthly trends. ${BRAND_NAME}.`;
  } else {
    title = `Precio m² en ${displayName}, ${city} | ${BRAND_NAME}`;
    description = ppm2
      ? `Mediana de precio por m² en ${displayName} (${city}): ${ppm2}. ${dossier.listingCount.toLocaleString("es-CO")} publicaciones activas, ${dossier.opportunityCount} oportunidades detectadas. Datos de anuncios Finca Raíz.`
      : `Dossier de mercado inmobiliario en ${displayName}, ${city}: publicaciones activas, mediana de precio/m² y tendencia mensual. ${BRAND_NAME}.`;
  }

  const canonical = canonicalForLocale(path, locale);
  const ogImage = zoneOgImage(dossier.citySlug, dossier.slug, locale);

  return {
    title: pageTitle(title),
    description,
    ...(!published ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical, languages: alt.languages },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: BRAND_NAME,
      locale: ogLocale(locale),
      type: "article",
      images: published ? [ogImageMeta(ogImage)] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: published ? [ogImage] : undefined,
    },
  };
}

export function zoneJsonLd(dossier: ZoneDossier, locale: Locale = "es") {
  const path = zonePagePath(dossier);
  const url = canonicalForLocale(path, locale);
  const name =
    locale === "en"
      ? `${dossier.displayName}, ${dossier.city} — price per m²`
      : `Precio m² en ${dossier.displayName}, ${dossier.city}`;

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description:
      locale === "en"
        ? `Median asking price per square meter and active listing statistics for ${dossier.displayName}, ${dossier.city}, Colombia.`
        : `Mediana de precio por metro cuadrado y estadísticas de publicaciones activas en ${dossier.displayName}, ${dossier.city}, Colombia.`,
    url,
    inLanguage: locale === "en" ? "en-US" : "es-CO",
    creator: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: absoluteUrl("/"),
    },
    spatialCoverage: {
      "@type": "Place",
      name: `${dossier.displayName}, ${dossier.city}, Colombia`,
    },
    variableMeasured: "Precio por metro cuadrado (COP)",
    ...(dossier.medianPricePerM2 != null
      ? {
          distribution: {
            "@type": "DataDownload",
            contentUrl: url,
            encodingFormat: "text/html",
          },
        }
      : {}),
  };
}

export function zonesIndexMetadata(locale: Locale = "es"): Metadata {
  const path = "/zones";
  const alt = hreflangAlternates(path);

  if (locale === "en") {
    const title = `Neighborhood dossiers — price per m² by zone | ${BRAND_NAME}`;
    const description =
      "Explore median price per m², active listings, and trends by neighborhood in Bogotá, Medellín, Cali, Pereira, and more Colombian cities. Data for local and US investors.";
    return {
      title: pageTitle(title),
      description,
      alternates: { canonical: canonicalForLocale(path, locale), languages: alt.languages },
      openGraph: {
        title,
        description,
        url: canonicalForLocale(path, locale),
        siteName: BRAND_NAME,
        locale: ogLocale(locale),
      },
      twitter: { card: "summary", title, description },
    };
  }

  const title = `Dossiers de barrios — precio m² por zona | ${BRAND_NAME}`;
  const description =
    "Explora mediana de precio por m², publicaciones activas y tendencias por barrio en Bogotá, Medellín, Cali, Pereira y más ciudades de Colombia.";
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
    },
    twitter: { card: "summary", title, description },
  };
}

export function zoneBreadcrumbItems(
  dossier: ZoneDossier,
  locale: Locale,
): Array<{ label: string; href: string }> {
  const home = locale === "en" ? "Home" : "Inicio";
  const zones = locale === "en" ? "Neighborhoods" : "Barrios";
  return [
    { label: home, href: localePath(locale, "/") },
    { label: zones, href: localePath(locale, "/zones") },
    {
      label: dossier.city,
      href: localePath(locale, `/zones/${dossier.citySlug}`),
    },
    {
      label: dossier.displayName,
      href: localePath(locale, zonePagePath(dossier)),
    },
  ];
}
