import type { Locale } from "@/lib/locale"

export type MethodologyFaq = { q: string; a: string }

export type MethodologyContent = {
  title: string
  intro: string
  sections: Array<{ heading: string; body: string }>
  dealExample: {
    heading: string
    intro: string
    rules: string[]
    cases: Array<{ label: string; body: string }>
  }
  limitations: string[]
  limitationsHeading: string
  faqHeading: string
  faqs: MethodologyFaq[]
}

export const methodologyContent: Record<Locale, MethodologyContent> = {
  es: {
    title: "Metodología de datos",
    intro:
      "CasasClaras transforma anuncios públicos de Finca Raíz en estadísticas de mercado por barrio en ciudades colombianas. Nuestro objetivo es transparencia: mostrar lo que el mercado publica como precio de pedido, no lo que alguien desearía.",
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
    dealExample: {
      heading: "Cómo se gana (o no) la etiqueta «buena oportunidad»",
      intro:
        "Cada anuncio se compara con anuncios parecidos (mismo tipo de inmueble y métrica de área). El descuento es la diferencia entre su precio/m² y la mediana de esos comparables.",
      rules: [
        "Barra del 12%: un anuncio es «buena oportunidad» solo si pide al menos 12% menos por m² que sus comparables. Entre −12% y +12% es «precio de mercado»; más de 12% por encima es «sobre el mercado».",
        "Regla de 1 km: si hay al menos 4 comparables a 1 km o menos, usamos esos. Si no, bajamos a la zona, luego al barrio y, como último recurso, a toda la ciudad.",
        "Confianza «media»: la muestra o los datos tienen algún hueco (pocos comparables, anuncio viejo, comparables de toda la ciudad o un descuento extremo). Un descuento mayor al 50% nunca puede tener confianza alta.",
        "«Revisar antes de confiar»: si el descuento supera el 50%, si los comparables son de toda la ciudad, o si más de la mitad de ellos están en otro barrio, el anuncio no recibe la etiqueta verde aunque pase la barra del 12%.",
      ],
      cases: [
        {
          label: "Caso A — se queda como «buena oportunidad»",
          body: "Apartamento de 80 m² en Pinares a $4.400.000/m². Hay 14 comparables a menos de 1 km, todos en Pinares, con mediana de $5.200.000/m². Descuento: 15%. Pasa la barra del 12%, los comparables son del mismo barrio y el descuento es creíble: «buena oportunidad».",
        },
        {
          label: "Caso B — pasa a «revisar»",
          body: "Apartamento de 110 m² etiquetado en Condina a $2.000.000/m². Los comparables a 1 km están casi todos en Cerritos, con mediana de $6.300.000/m². Descuento: 68%. Supera el 50% y la mayoría de comparables está en otro barrio, así que lo marcamos «revisar»: puede ser un error de área, de barrio o de precio en el anuncio. Confirma antes de visitar.",
        },
      ],
    },
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
        a: "No. CasasClaras agrega precios publicados en estadísticas (mediana, conteos, tendencias). No sustituye una valoración profesional, due diligence legal ni asesoría de inversión.",
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
      "CasasClaras transforms publicly listed Finca Raíz advertisements into neighborhood-level market statistics for Colombian cities. Our goal is transparency: show what the market is actually asking, not what anyone wishes it were.",
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
    dealExample: {
      heading: "How a listing earns (or loses) the “good deal” label",
      intro:
        "Each listing is compared with similar listings (same property type and area metric). The discount is the gap between its price per m² and the median of those comps.",
      rules: [
        "12% bar: a listing is a “good deal” only if it asks at least 12% less per m² than its comps. Between −12% and +12% is “fair”; more than 12% above is “overpriced”.",
        "1 km rule: if there are at least 4 comps within 1 km, we use those. Otherwise we fall back to the zone, then the neighborhood, and only as a last resort the whole city.",
        "“Medium” confidence: the sample or the data has a gap (few comps, an old listing, city-wide comps, or an extreme discount). A discount above 50% can never get high confidence.",
        "“Check before trusting”: if the discount is above 50%, the comps are city-wide, or more than half of them sit in another neighborhood, the listing does not get the green label even if it clears the 12% bar.",
      ],
      cases: [
        {
          label: "Case A — stays a “good deal”",
          body: "80 m² apartment in Pinares at COP 4,400,000/m². There are 14 comps within 1 km, all in Pinares, with a median of COP 5,200,000/m². Discount: 15%. It clears the 12% bar, the comps are in the same neighborhood, and the discount is plausible: “good deal”.",
        },
        {
          label: "Case B — becomes “check before trusting”",
          body: "110 m² apartment labeled Condina at COP 2,000,000/m². The comps within 1 km are almost all in Cerritos, with a median of COP 6,300,000/m². Discount: 68%. It is above 50% and most comps are in another neighborhood, so we flag it for review: the ad may have the wrong area, neighborhood, or price. Confirm before visiting.",
        },
      ],
    },
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
        a: "No. CasasClaras aggregates published asking prices into statistics (median, counts, trends). It is not a substitute for professional valuation, legal due diligence, or investment advice. US investors should consult local experts.",
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
