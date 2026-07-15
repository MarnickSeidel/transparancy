import type { Metadata } from "next";

import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { methodologyFaqJsonLdFromCopy } from "@/lib/methodologyCopy";
import { ogLocale, type Locale } from "@/lib/locale";

type TrustPage = "methodology" | "privacy" | "about";

const COPY: Record<
  TrustPage,
  Record<Locale, { title: string; description: string }>
> = {
  methodology: {
    es: {
      title: "Metodología de datos | ClaraCasas",
      description:
        "Cómo ClaraCasas recopila, procesa y publica datos de anuncios Finca Raíz para análisis de precio/m² por barrio en Colombia.",
    },
    en: {
      title: "Data methodology | ClaraCasas",
      description:
        "How ClaraCasas collects, processes, and publishes Finca Raíz listing data for neighborhood price/m² analysis in Colombia.",
    },
  },
  privacy: {
    es: {
      title: "Política de privacidad | ClaraCasas",
      description:
        "Información sobre cookies, almacenamiento local y tratamiento de datos en la plataforma ClaraCasas.",
    },
    en: {
      title: "Privacy policy | ClaraCasas",
      description:
        "Information about cookies, local storage, and data handling on the ClaraCasas platform.",
    },
  },
  about: {
    es: {
      title: "Acerca de ClaraCasas",
      description:
        "ClaraCasas: inteligencia inmobiliaria con datos de publicaciones en Colombia. Transparencia de mercado para inversionistas.",
    },
    en: {
      title: "About ClaraCasas",
      description:
        "ClaraCasas: real estate intelligence from Colombian listing data. Market transparency for local and US investors.",
    },
  },
};

export function trustPageMetadata(page: TrustPage, locale: Locale): Metadata {
  const path = `/${page}`;
  const alt = hreflangAlternates(path);
  const { title, description } = COPY[page][locale];

  return {
    title,
    description,
    alternates: {
      canonical: canonicalForLocale(path, locale),
      languages: alt.languages,
    },
    openGraph: {
      title,
      description,
      url: canonicalForLocale(path, locale),
      siteName: "ClaraCasas",
      locale: ogLocale(locale),
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

export function methodologyFaqJsonLd(locale: Locale) {
  return methodologyFaqJsonLdFromCopy(locale);
}

export function homeJsonLd(locale: Locale) {
  const url = canonicalForLocale("/", locale);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ClaraCasas",
      url,
      description:
        locale === "en"
          ? "Colombian real estate market intelligence from Finca Raíz listing data."
          : "Inteligencia inmobiliaria con datos de publicaciones en Colombia.",
      inLanguage: locale === "en" ? "en-US" : "es-CO",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ClaraCasas",
      url,
      description:
        locale === "en"
          ? "Data-driven real estate analytics for Colombia."
          : "Analítica inmobiliaria con datos en Colombia.",
    },
  ];
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  locale: Locale,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalForLocale(item.path, locale),
    })),
  };
}
