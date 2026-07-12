import type { Metadata, Viewport } from "next";

import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { ogLocale, type Locale } from "@/lib/locale";
import { absoluteUrl } from "@/lib/siteUrl";

export const defaultSiteMetadata = {
  siteName: "Habidata",
  defaultTitle: "Habidata — Inteligencia inmobiliaria con datos en Colombia",
  defaultDescription:
    "Analítica de publicaciones Finca Raíz: precio/m² por barrio, oportunidades infravaloradas, mapas y estimadores para inversionistas en Colombia.",
};

export function rootMetadata(locale: Locale = "es"): Metadata {
  const path = "/";
  const alt = hreflangAlternates(path);

  const defaultTitle =
    locale === "en"
      ? "Habidata — Real estate data intelligence for Colombia"
      : defaultSiteMetadata.defaultTitle;
  const defaultDescription =
    locale === "en"
      ? "Finca Raíz listing analytics: price/m² by neighborhood, undervalued opportunities, heatmaps, and estimators for local and US investors in Colombia."
      : defaultSiteMetadata.defaultDescription;

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: {
      default: defaultTitle,
      template: "%s | Habidata",
    },
    description: defaultDescription,
    alternates: {
      canonical: canonicalForLocale(path, locale),
      languages: alt.languages,
    },
    openGraph: {
      title: defaultTitle,
      description: defaultDescription,
      url: canonicalForLocale(path, locale),
      siteName: defaultSiteMetadata.siteName,
      locale: ogLocale(locale),
      type: "website",
      images: [{ url: absoluteUrl("/branding/habidata-logo-horizontal.svg") }],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [absoluteUrl("/branding/habidata-mark.svg")],
    },
    icons: {
      icon: "/branding/habidata-mark.svg",
      shortcut: "/branding/habidata-mark.svg",
      apple: "/branding/habidata-mark.svg",
    },
  };
}

/** Tool/dashboard routes: thin CSR shells — keep out of index until SSR content exists. */
export function noIndexMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: true },
  };
}

export function homeMetadata(locale: Locale = "es"): Metadata {
  const path = "/";
  const alt = hreflangAlternates(path);

  if (locale === "en") {
    const title = "Habidata — Spot undervalued property in Colombia";
    const description =
      "Data-driven real estate platform: price/m² by neighborhood, deal scoring, heatmaps, and price estimator from Finca Raíz listings. Built for local and US investors.";
    const url = canonicalForLocale(path, locale);
    return {
      title,
      description,
      alternates: { canonical: url, languages: alt.languages },
      openGraph: {
        title,
        description,
        url,
        siteName: defaultSiteMetadata.siteName,
        locale: ogLocale(locale),
        type: "website",
      },
      twitter: { card: "summary", title, description },
    };
  }

  const title = "Habidata — Detecta propiedades infravaloradas en Colombia";
  const description =
    "Plataforma de datos inmobiliarios: precio/m² por barrio, scoring de oportunidades, heatmaps y estimador basado en publicaciones Finca Raíz.";
  const url = alt.canonical;
  return {
    title,
    description,
    alternates: { canonical: url, languages: alt.languages },
    openGraph: {
      title,
      description,
      url,
      siteName: defaultSiteMetadata.siteName,
      locale: ogLocale(locale),
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c45c26",
};
