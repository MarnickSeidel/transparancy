import type { Metadata, Viewport } from "next";

import { BRAND_COLOR, BRAND_COPY, BRAND_LOGO, BRAND_NAME } from "@/lib/brand";
import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { opportunitiesPath, ogLocale, type Locale } from "@/lib/locale";
import { localeOgImage, ogImageMeta, opportunitiesOgImage } from "@/lib/ogImages";
import { absoluteUrl } from "@/lib/siteUrl";

export const defaultSiteMetadata = {
  siteName: BRAND_NAME,
  defaultTitle: BRAND_COPY.es.defaultTitle,
  defaultDescription:
    "Analítica de publicaciones Finca Raíz: precio/m² por barrio, oportunidades infravaloradas, mapas y estimadores para inversionistas en Colombia.",
};

export function rootMetadata(locale: Locale = "es"): Metadata {
  const path = "/";
  const alt = hreflangAlternates(path);

  const defaultTitle =
    locale === "en"
      ? BRAND_COPY.en.defaultTitle
      : defaultSiteMetadata.defaultTitle;
  const defaultDescription =
    locale === "en"
      ? "Finca Raíz listing analytics: price/m² by neighborhood, undervalued opportunities, heatmaps, and estimators for local and US investors in Colombia."
      : defaultSiteMetadata.defaultDescription;

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: {
      default: defaultTitle,
      template: `%s | ${BRAND_NAME}`,
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
      images: [ogImageMeta(localeOgImage(locale))],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [localeOgImage(locale)],
    },
    icons: {
      icon: BRAND_LOGO.mark,
      shortcut: BRAND_LOGO.mark,
      apple: BRAND_LOGO.markImage,
    },
  };
}

export function opportunitiesMetadata(locale: Locale = "es"): Metadata {
  const languages = {
    es: absoluteUrl(opportunitiesPath("es")),
    en: absoluteUrl(opportunitiesPath("en")),
    "x-default": absoluteUrl(opportunitiesPath("es")),
  };

  if (locale === "en") {
    const title = "Undervalued property opportunities in Colombia";
    const description =
      "Ranked Finca Raíz listings by relative discount vs neighborhood benchmarks — ClaraCasas deal finder.";
    const url = absoluteUrl(opportunitiesPath("en"));
    const ogImage = opportunitiesOgImage();
    return {
      title,
      description,
      alternates: { canonical: url, languages },
      openGraph: {
        title,
        description,
        url,
        siteName: defaultSiteMetadata.siteName,
        locale: ogLocale(locale),
        type: "website",
        images: [ogImageMeta(ogImage)],
      },
      twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
  }

  const title = "Oportunidades inmobiliarias";
  const description =
    "Ranking de publicaciones con mejor descuento relativo frente al mercado del barrio — herramienta ClaraCasas.";
  const url = absoluteUrl(opportunitiesPath("es"));
  const ogImage = opportunitiesOgImage();
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      title,
      description,
      url,
      siteName: defaultSiteMetadata.siteName,
      locale: ogLocale(locale),
      type: "website",
      images: [ogImageMeta(ogImage)],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
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
    const title = BRAND_COPY.en.homeTitle;
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
        images: [ogImageMeta(localeOgImage(locale))],
      },
      twitter: { card: "summary_large_image", title, description, images: [localeOgImage(locale)] },
    };
  }

  const title = BRAND_COPY.es.homeTitle;
  const description =
    "Plataforma de datos inmobiliarios: precio/m² por barrio, scoring de oportunidades, heatmaps y estimador basado en publicaciones Finca Raíz.";
  const url = alt.canonical;
  const ogImage = localeOgImage(locale);
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
      images: [ogImageMeta(ogImage)],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: BRAND_COLOR,
};
