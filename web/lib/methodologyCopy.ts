import type { Locale } from "@/lib/locale"

export type MethodologyFaq = { q: string; a: string }

export type MethodologyContent = {
  title: string
  intro: string
  sections: Array<{ heading: string; body: string }>
  limitations: string[]
  limitationsHeading: string
  faqHeading: string
  faqs: MethodologyFaq[]
}

export const methodologyContent: Record<Locale, MethodologyContent> = {
  es: {
    title: "Metodología de datos",
    intro:
      "ClaraCasas transforma anuncios públicos de Finca Raíz en estadísticas de mercado por barrio en ciudades colombianas. Nuestro objetivo es transparencia: mostrar lo que el mercado publica como precio de pedido, no lo que alguien desearía.",
    sections: [
      {
        heading: "Recopilación",
        body: "Los anuncios se obtienen de fincaraiz.com.co, se normalizan, deduplican por ID de fuente y se almacenan con metadatos (ciudad, barrio, precio, área, tipo de inmueble, coordenadas cuando existen).",
      },
      {
        heading: "Agregación",
        body: "Los barrios se agrupan con una clave canónica (ciudad + barrio normalizado). Calculamos medianas, conteos, desglose por tipo de inmueble y tendencias mensuales cuando la muestra lo permite.",
      },
    ],
    limitations: [
      "Precio publicado ≠ precio de cierre.",
      "Los nombres de barrio en anuncios pueden variar; mostramos alias cuando los detectamos.",
      "Las páginas en inglés pueden mostrar equivalentes en USD con una tasa indicativa — no es FX en vivo.",
    ],
    limitationsHeading: "Limitaciones",
    faqHeading: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿De dónde provienen los datos?",
        a: "De publicaciones activas e históricas de Finca Raíz (fincaraiz.com.co), recopiladas mediante scraping automatizado en ciclos programados.",
      },
      {
        q: "¿Es esto una tasación o asesoría de inversión?",
        a: "No. ClaraCasas agrega precios publicados en estadísticas (mediana, conteos, tendencias). No sustituye una valoración profesional, due diligence legal ni asesoría de inversión.",
      },
      {
        q: "¿Cómo se calcula el precio/m²?",
        a: "Usamos el precio/m² del anuncio cuando está disponible; si no, precio ÷ área. Solo entran anuncios con precio y área válidos en las medianas.",
      },
      {
        q: "¿Con qué frecuencia se actualizan los datos?",
        a: "El inventario se refresca periódicamente con scraping programado (habitualmente mensual por ciudad). Las páginas de barrio se regeneran cada 5 minutos (ISR): muestran lo último que tenemos, no el mercado en tiempo real.",
      },
      {
        q: "¿Qué es un barrio «publicable»?",
        a: "Barrios con al menos 20 anuncios con precio/m² válido. Por debajo de ese umbral, la página puede existir pero lleva noindex.",
      },
    ],
  },
  en: {
    title: "Data methodology",
    intro:
      "ClaraCasas transforms publicly listed Finca Raíz advertisements into neighborhood-level market statistics for Colombian cities. Our goal is transparency: show what the market is actually asking, not what anyone wishes it were.",
    sections: [
      {
        heading: "Collection",
        body: "Listings are scraped from fincaraiz.com.co, normalized, deduplicated by source ID, and stored with metadata (city, neighborhood, price, area, property type, coordinates when available).",
      },
      {
        heading: "Aggregation",
        body: "Neighborhoods are grouped using a canonical bucket key derived from city + normalized neighborhood name. We compute medians, listing counts, property-type breakdowns, and monthly trends where sample size allows.",
      },
    ],
    limitations: [
      "Asking prices ≠ closed transaction prices.",
      "Neighborhood labels in ads can be inconsistent; we show alias names when detected.",
      "USD equivalents on English pages use an indicative rate — not live FX.",
    ],
    limitationsHeading: "Limitations",
    faqHeading: "FAQ",
    faqs: [
      {
        q: "Where does the data come from?",
        a: "Active and historical listings from Finca Raíz (fincaraiz.com.co), collected via automated scraping on a scheduled cadence.",
      },
      {
        q: "Is this an appraisal or investment advice?",
        a: "No. ClaraCasas aggregates published asking prices into statistics (median, counts, trends). It is not a substitute for professional valuation, legal due diligence, or investment advice. US investors should consult local experts.",
      },
      {
        q: "How is price per m² calculated?",
        a: "We use the listing's stated price/m² when available, otherwise price ÷ area. Only listings with valid price and area contribute to medians.",
      },
      {
        q: "How often is data updated?",
        a: "Listing inventory is refreshed periodically via scheduled scraping (typically monthly per city). Neighborhood pages revalidate every 5 minutes (ISR) — they show the latest data we have, not live market ticks.",
      },
      {
        q: "What is a 'publishable' neighborhood?",
        a: "Neighborhoods with at least 20 listings that have valid price/m² data. Below that threshold, pages exist but are marked noindex.",
      },
    ],
  },
}

export const methodologyFaqJsonLdFromCopy = (locale: Locale) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: methodologyContent[locale].faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
})
