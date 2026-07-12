import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageFooter from "@/app/components/PageFooter";
import { localePath, type Locale, LOCALES } from "@/lib/locale";
import { trustPageMetadata } from "@/lib/trustSeo";

export const revalidate = 86400;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("about", params.locale as Locale);
}

export default function AboutPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const lp = (path: string) => localePath(locale, path);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Link href={lp("/")} className="text-sm font-semibold text-accent hover:underline">
          ← Habidata
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-foreground">
          {locale === "en" ? "About Habidata" : "Acerca de Habidata"}
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          {locale === "en" ? (
            <>
              <p>
                Habidata brings transparency to Colombia&apos;s residential listing market. We aggregate
                Finca Raíz advertisements into neighborhood dossiers — median price per m², active
                listing counts, property-type mix, and monthly trends — so local buyers and US investors
                can research with data instead of anecdotes.
              </p>
              <p>
                The platform also includes internal tools (deal scoring, heatmaps, URL analysis, price
                estimator) for deeper research. Those tools are not indexed by search engines.
              </p>
              <p>
                <strong className="text-foreground">Disclaimer:</strong> Habidata is not a licensed
                broker, appraiser, or investment advisor. All figures reflect published asking prices.
              </p>
              <p>
                Explore{" "}
                <Link href={lp("/zones")} className="text-accent hover:underline">
                  neighborhood dossiers
                </Link>{" "}
                or read our{" "}
                <Link href={lp("/methodology")} className="text-accent hover:underline">
                  methodology
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p>
                Habidata aporta transparencia al mercado de publicaciones residenciales en Colombia.
                Agregamos anuncios de Finca Raíz en dossiers por barrio — mediana de precio/m²,
                publicaciones activas, mix por tipo de inmueble y tendencias mensuales.
              </p>
              <p>
                La plataforma incluye herramientas internas (scoring, heatmaps, análisis por URL,
                estimador) para investigación más profunda. Esas herramientas no están indexadas.
              </p>
              <p>
                <strong className="text-foreground">Aviso:</strong> Habidata no es corredor, tasador ni
                asesor de inversión. Las cifras reflejan precios publicados.
              </p>
            </>
          )}
        </div>
      </main>
      <PageFooter locale={locale} />
    </div>
  );
}
