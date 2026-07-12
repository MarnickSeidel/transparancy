import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageFooter from "@/app/components/PageFooter";
import { localePath, type Locale, LOCALES } from "@/lib/locale";
import { methodologyFaqJsonLd, trustPageMetadata } from "@/lib/trustSeo";

export const revalidate = 86400;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("methodology", params.locale as Locale);
}

export default function MethodologyPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const lp = (path: string) => localePath(locale, path);
  const faqJsonLd = methodologyFaqJsonLd(locale);

  const faqs =
    locale === "en"
      ? [
          {
            q: "Where does the data come from?",
            a: "Active and historical listings from Finca Raíz (fincaraiz.com.co), collected via automated scraping on a rolling schedule.",
          },
          {
            q: "Is this an appraisal or investment advice?",
            a: "No. Habidata aggregates published asking prices into statistics (median, counts, trends). It is not a substitute for professional valuation, legal due diligence, or investment advice. US investors should consult local experts.",
          },
          {
            q: "How is price per m² calculated?",
            a: "We use the listing's stated price/m² when available, otherwise price ÷ area. Only listings with valid price and area contribute to medians.",
          },
          {
            q: "How often is data updated?",
            a: "The scraper runs continuously. Neighborhood pages revalidate every 5 minutes (ISR).",
          },
          {
            q: "What is a 'publishable' neighborhood?",
            a: "Neighborhoods with at least 20 listings that have valid price/m² data. Below that threshold, pages exist but are marked noindex.",
          },
        ]
      : [
          {
            q: "¿De dónde provienen los datos?",
            a: "De publicaciones activas e históricas de Finca Raíz (fincaraiz.com.co), recopiladas mediante scraping automatizado.",
          },
          {
            q: "¿Es esto una tasación?",
            a: "No. Habidata agrega precios publicados en estadísticas (mediana, conteos, tendencias). No sustituye una valoración profesional ni asesoría de inversión.",
          },
          {
            q: "¿Cómo se calcula el precio/m²?",
            a: "Usamos el precio/m² del anuncio cuando está disponible; si no, precio ÷ área. Solo entran anuncios con precio y área válidos.",
          },
          {
            q: "¿Con qué frecuencia se actualizan?",
            a: "El scraper corre de forma continua. Las páginas de barrio se regeneran cada 5 minutos (ISR).",
          },
          {
            q: "¿Qué es un barrio 'publicable'?",
            a: "Barrios con al menos 20 anuncios con precio/m² válido. Por debajo de ese umbral, la página existe pero lleva noindex.",
          },
        ];

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Link href={lp("/")} className="text-sm font-semibold text-accent hover:underline">
          ← Habidata
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-foreground">
          {locale === "en" ? "Data methodology" : "Metodología de datos"}
        </h1>
        <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
          {locale === "en" ? (
            <>
              <p className="text-muted leading-relaxed">
                Habidata transforms publicly listed Finca Raíz advertisements into neighborhood-level
                market statistics for Colombian cities. Our goal is transparency: show what the market
                is actually asking, not what anyone wishes it were.
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Collection</h2>
              <p className="text-muted leading-relaxed">
                Listings are scraped from fincaraiz.com.co, normalized, deduplicated by source ID,
                and stored with metadata (city, neighborhood, price, area, property type, coordinates
                when available).
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Aggregation</h2>
              <p className="text-muted leading-relaxed">
                Neighborhoods are grouped using a canonical bucket key derived from city + normalized
                neighborhood name. We compute medians, listing counts, property-type breakdowns, and
                monthly trends where sample size allows.
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Limitations</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
                <li>Asking prices ≠ closed transaction prices.</li>
                <li>Neighborhood labels in ads can be inconsistent; we show alias names when detected.</li>
                <li>USD equivalents on English pages use an indicative rate — not live FX.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-muted leading-relaxed">
                Habidata transforma anuncios públicos de Finca Raíz en estadísticas de mercado por
                barrio en ciudades colombianas. Nuestro objetivo es transparencia: mostrar lo que el
                mercado publica, no lo que alguien desearía.
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Recopilación</h2>
              <p className="text-muted leading-relaxed">
                Los anuncios se obtienen de fincaraiz.com.co, se normalizan, deduplican por ID de
                fuente y se almacenan con metadatos (ciudad, barrio, precio, área, tipo, coordenadas
                cuando existen).
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Agregación</h2>
              <p className="text-muted leading-relaxed">
                Los barrios se agrupan con una clave canónica (ciudad + barrio normalizado).
                Calculamos medianas, conteos, desglose por tipo de inmueble y tendencias mensuales
                cuando la muestra lo permite.
              </p>
              <h2 className="mt-8 text-xl font-semibold text-foreground">Limitaciones</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
                <li>Precio publicado ≠ precio de cierre.</li>
                <li>Los nombres de barrio en anuncios pueden variar; mostramos alias cuando los detectamos.</li>
              </ul>
            </>
          )}
        </div>
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">FAQ</h2>
          <dl className="mt-6 space-y-6">
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-semibold text-foreground">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <PageFooter locale={locale} />
    </div>
  );
}
