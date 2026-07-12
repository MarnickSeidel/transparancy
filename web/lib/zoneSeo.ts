import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/siteUrl";
import type { ZoneDossier } from "@/lib/zones";

function fmtCopShort(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return `$${Math.round(v).toLocaleString("es-CO")}`;
}

export function zonePagePath(dossier: Pick<ZoneDossier, "citySlug" | "slug">): string {
  return `/zones/${encodeURIComponent(dossier.citySlug)}/${encodeURIComponent(dossier.slug)}`;
}

export function zonePageMetadata(dossier: ZoneDossier): Metadata {
  const { displayName, city } = dossier;
  const ppm2 = fmtCopShort(dossier.medianPricePerM2);
  const title = `Precio m² en ${displayName}, ${city} | Habidata`;
  const description = ppm2
    ? `Mediana de precio por m² en ${displayName} (${city}): ${ppm2}. ${dossier.listingCount.toLocaleString("es-CO")} publicaciones activas, ${dossier.opportunityCount} oportunidades detectadas. Datos de anuncios Finca Raíz.`
    : `Dossier de mercado inmobiliario en ${displayName}, ${city}: publicaciones activas, mediana de precio/m² y tendencia mensual. Habidata.`;

  const url = absoluteUrl(zonePagePath(dossier));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Habidata",
      locale: "es_CO",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function zoneJsonLd(dossier: ZoneDossier) {
  const url = absoluteUrl(zonePagePath(dossier));
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Precio m² en ${dossier.displayName}, ${dossier.city}`,
    description: `Mediana de precio por metro cuadrado y estadísticas de publicaciones activas en ${dossier.displayName}, ${dossier.city}, Colombia.`,
    url,
    creator: {
      "@type": "Organization",
      name: "Habidata",
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

export function zonesIndexMetadata(): Metadata {
  const title = "Dossiers de barrios — precio m² por zona | Habidata";
  const description =
    "Explora mediana de precio por m², publicaciones activas y tendencias por barrio en Bogotá, Medellín, Cali, Pereira y más ciudades de Colombia.";
  const url = absoluteUrl("/zones");
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Habidata", locale: "es_CO" },
    twitter: { card: "summary", title, description },
  };
}
