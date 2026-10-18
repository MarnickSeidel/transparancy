import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import TrustPageChrome from "@/app/components/TrustPageChrome"
import { localePath, type Locale, LOCALES } from "@/lib/locale"
import { trustPageMetadata } from "@/lib/trustSeo"

export const revalidate = 86400

type Props = { params: { locale: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("about", params.locale as Locale)
}

export default function AboutPage({ params }: Props) {
  const locale = params.locale as Locale
  if (!LOCALES.includes(locale)) notFound()

  const lp = (path: string) => localePath(locale, path)
  const isEn = locale === "en"

  return (
    <TrustPageChrome locale={locale}>
      <h1 className="text-display text-3xl font-semibold text-foreground">
        {isEn ? "About CasasClaras" : "Acerca de CasasClaras"}
      </h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        {isEn ? (
          <>
            <p>
              CasasClaras is listing-price intelligence for Colombia&apos;s residential market. We turn
              Finca Raíz (and Metrocuadrado for URL analysis) asking prices into neighborhood context —
              median price per m², active inventory, property mix, and deal scores versus comps — so
              local buyers and US investors can research with data instead of anecdotes.
            </p>
            <p>
              Two ways in:{" "}
              <Link href={lp("/analyze-url")} className="text-accent hover:underline">
                check a specific listing
              </Link>{" "}
              against barrio comps, or{" "}
              <Link href={lp("/oportunidades")} className="text-accent hover:underline">
                browse ranked undervalued deals
              </Link>
              . Neighborhood dossiers and other research tools support both paths.
            </p>
            <div>
              <p className="font-semibold text-foreground">What we do</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Aggregate active residential listing asking prices</li>
                <li>Publish barrio dossiers when sample size is sufficient</li>
                <li>Score listings vs similar comps (estrato, type, area)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">What we don&apos;t do</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Appraisals, closed-sale data, or investment advice</li>
                <li>Brokerage or property transactions</li>
                <li>Guarantee that a &quot;good deal&quot; score means a bargain at closing</li>
              </ul>
            </div>
            <p>
              <strong className="text-foreground">Disclaimer:</strong> CasasClaras is not a licensed
              broker, appraiser, or investment advisor. All figures reflect published asking prices.
            </p>
            <p>
              Explore{" "}
              <Link href={lp("/zones")} className="text-accent hover:underline">
                neighborhood dossiers
              </Link>
              , read our{" "}
              <Link href={lp("/methodology")} className="text-accent hover:underline">
                methodology
              </Link>
              , or start with{" "}
              <Link href={lp("/analyze-url")} className="text-accent hover:underline">
                a listing check
              </Link>{" "}
              /{" "}
              <Link href={lp("/oportunidades")} className="text-accent hover:underline">
                opportunities
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <p>
              CasasClaras es inteligencia de precios de avisos para el mercado residencial en Colombia.
              Convertimos precios publicados de Finca Raíz (y Metrocuadrado en el análisis por URL) en
              contexto de barrio — mediana de precio/m², inventario activo, mix por tipo y scoring vs
              comparables — para que compradores locales e inversores investiguen con datos, no con
              anécdotas.
            </p>
            <p>
              Dos puertas:{" "}
              <Link href={lp("/analyze-url")} className="text-accent hover:underline">
                analiza un anuncio concreto
              </Link>{" "}
              contra el barrio, o{" "}
              <Link href={lp("/oportunidades")} className="text-accent hover:underline">
                explora oportunidades infravaloradas
              </Link>
              . Los dossiers por barrio y otras herramientas apoyan ambos caminos.
            </p>
            <div>
              <p className="font-semibold text-foreground">Qué hacemos</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Agregamos precios de aviso de publicaciones residenciales activas</li>
                <li>Publicamos dossiers de barrio cuando hay muestra suficiente</li>
                <li>Puntuamos anuncios vs comparables similares (estrato, tipo, área)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Qué no hacemos</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Tasaciones, datos de ventas cerradas ni asesoría de inversión</li>
                <li>Corretaje ni transacciones inmobiliarias</li>
                <li>Garantizar que un buen score sea un buen cierre</li>
              </ul>
            </div>
            <p>
              <strong className="text-foreground">Aviso:</strong> CasasClaras no es corredor, tasador ni
              asesor de inversión. Las cifras reflejan precios publicados.
            </p>
            <p>
              Explora{" "}
              <Link href={lp("/zones")} className="text-accent hover:underline">
                dossiers por barrio
              </Link>
              , lee nuestra{" "}
              <Link href={lp("/methodology")} className="text-accent hover:underline">
                metodología
              </Link>
              , o empieza con{" "}
              <Link href={lp("/analyze-url")} className="text-accent hover:underline">
                un análisis de anuncio
              </Link>{" "}
              /{" "}
              <Link href={lp("/oportunidades")} className="text-accent hover:underline">
                oportunidades
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </TrustPageChrome>
  )
}
