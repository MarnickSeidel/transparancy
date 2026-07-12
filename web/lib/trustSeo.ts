import type { Metadata } from "next";

import { canonicalForLocale, hreflangAlternates } from "@/lib/hreflang";
import { ogLocale, type Locale } from "@/lib/locale";

type TrustPage = "methodology" | "privacy" | "about";

const COPY: Record<
  TrustPage,
  Record<Locale, { title: string; description: string }>
> = {
  methodology: {
    es: {
      title: "Metodología de datos | Habidata",
      description:
        "Cómo Habidata recopila, procesa y publica datos de anuncios Finca Raíz para análisis de precio/m² por barrio en Colombia.",
    },
    en: {
      title: "Data methodology | Habidata",
      description:
        "How Habidata collects, processes, and publishes Finca Raíz listing data for neighborhood price/m² analysis in Colombia.",
    },
  },
  privacy: {
    es: {
      title: "Política de privacidad | Habidata",
      description:
        "Información sobre cookies, almacenamiento local y tratamiento de datos en la plataforma Habidata.",
    },
    en: {
      title: "Privacy policy | Habidata",
      description:
        "Information about cookies, local storage, and data handling on the Habidata platform.",
    },
  },
  about: {
    es: {
      title: "Acerca de Habidata",
      description:
        "Habidata: inteligencia inmobiliaria con datos de publicaciones en Colombia. Transparencia de mercado para inversionistas.",
    },
    en: {
      title: "About Habidata",
      description:
        "Habidata: real estate intelligence from Colombian listing data. Market transparency for local and US investors.",
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
      siteName: "Habidata",
      locale: ogLocale(locale),
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

export function methodologyFaqJsonLd(locale: Locale) {
  const faqs =
    locale === "es"
      ? [
          {
            q: "¿De dónde provienen los datos?",
            a: "De publicaciones activas e históricas de Finca Raíz, recopiladas periódicamente mediante scraping automatizado.",
          },
          {
            q: "¿Es esto una tasación?",
            a: "No. Habidata muestra estadísticas agregadas de precios publicados. No sustituye una valoración profesional.",
          },
          {
            q: "¿Con qué frecuencia se actualizan los datos?",
            a: "El scraper se ejecuta de forma continua. Las páginas de barrio se regeneran cada pocos minutos (ISR).",
          },
        ]
      : [
          {
            q: "Where does the data come from?",
            a: "From active and historical Finca Raíz listings, collected periodically via automated scraping.",
          },
          {
            q: "Is this an appraisal?",
            a: "No. Habidata shows aggregated asking-price statistics. It does not replace a professional valuation or investment advice.",
          },
          {
            q: "How often is data updated?",
            a: "The scraper runs continuously. Neighborhood pages revalidate every few minutes.",
          },
        ];

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function homeJsonLd(locale: Locale) {
  const url = canonicalForLocale("/", locale);
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Habidata",
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
      name: "Habidata",
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
