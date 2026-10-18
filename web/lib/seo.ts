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
      "Ranked Finca Raíz listings by relative discount vs neighborhood benchmarks — CasasClaras deal finder.";
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
    "Ranking de publicaciones con mejor descuento relativo frente al mercado del barrio — herramienta CasasClaras.";
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

/**
 * Document `<title>`. The root layout template appends `| CasasClaras`.
 * Titles that already name the brand stay absolute so it is not repeated.
 */
export function pageTitle(title: string): Metadata["title"] {
  return title.includes(BRAND_NAME) ? { absolute: title } : title;
}

/** Tool/dashboard routes: thin CSR shells — keep out of index until SSR content exists. */
export function noIndexMetadata(title: string, description?: string): Metadata {
  return {
    title: pageTitle(title),
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
      "Colombia listing-price intelligence: check any ad against barrio comps, or browse ranked undervalued deals. Asking prices from Finca Raíz — not appraisals. For local and US investors.";
    const url = canonicalForLocale(path, locale);
    return {
      title: pageTitle(title),
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
    "Inteligencia de precios de avisos en Colombia: analiza un anuncio contra el barrio o explora oportunidades infravaloradas. Precios de publicación Finca Raíz — no tasaciones.";
  const url = alt.canonical;
  const ogImage = localeOgImage(locale);
  return {
    title: pageTitle(title),
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
