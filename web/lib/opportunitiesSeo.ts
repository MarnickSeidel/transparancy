import { opportunitiesPath, type Locale } from "@/lib/locale"
import { absoluteUrl } from "@/lib/siteUrl"

export const opportunitiesJsonLd = (locale: Locale = "es") => {
  const url = absoluteUrl(opportunitiesPath(locale))
  const name =
    locale === "en"
      ? "Undervalued property opportunities in Colombia"
      : "Oportunidades inmobiliarias en Colombia"

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description:
      locale === "en"
        ? "Ranked Finca Raíz listings by relative discount vs neighborhood benchmarks."
        : "Ranking de publicaciones con descuento relativo frente al mercado del barrio.",
    url,
    inLanguage: locale === "en" ? "en-US" : "es-CO",
    isPartOf: {
      "@type": "WebSite",
      name: "CasasClaras",
      url: absoluteUrl("/"),
    },
    about: {
      "@type": "Thing",
      name: locale === "en" ? "Colombia residential real estate" : "Mercado inmobiliario residencial Colombia",
    },
  }
}
