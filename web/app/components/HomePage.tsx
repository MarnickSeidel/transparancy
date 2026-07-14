"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import AppHeader from "@/app/components/AppHeader"
import CartographicPreview from "@/app/components/CartographicPreview"
import DealComparisonBar from "@/app/components/DealComparisonBar"
import PageFooter from "@/app/components/PageFooter"
import Badge from "@/app/components/ui/Badge"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import type { HomePageData } from "@/lib/getHomeStats"
import { formatFreshnessDate } from "@/lib/getDataFreshness"
import {
  DEFAULT_OPPORTUNITIES_CITY,
  type OpportunityRow,
} from "@/lib/getTopOpportunities"
import { listingPath, localePath, localeToolPath, type Locale } from "@/lib/locale"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import { uiText } from "@/lib/i18n"
import { useUiLang } from "@/lib/useUiLang"

type Content = {
  eyebrow: string
  heading: string
  blurb: string
  ctaPrimary: string
  ctaSecondary: string
  dealsLabel: string
  statsLoading: string
  statsListingsLabel: string
  statsNeighborhoodsLabel: string
  statsCitiesLabel: string
  mapTitle: string
  mapView: string
  mapMedian: string
  mapListings: string
  features: Array<{ title: string; description: string }>
  journeysTitle: string
  journeys: Array<{ title: string; description: string; href: string; cta: string }>
}

const content: Record<"es" | "en", Content> = {
  es: {
    eyebrow: "Datos Finca Raíz · Colombia",
    heading: "Precio por m² con contexto de barrio, no solo anuncios.",
    blurb:
      "Compara cada publicación contra la mediana de su zona, estrato y tipo. Barrios en Pereira, Medellín, Bogotá y más — inventario actualizado periódicamente desde Finca Raíz.",
    ctaPrimary: "¿Buen precio?",
    ctaSecondary: "Explorar barrios",
    dealsLabel: "Oportunidades recientes",
    statsLoading: "Cargando datos…",
    statsListingsLabel: "Anuncios analizados",
    statsNeighborhoodsLabel: "Barrios con datos",
    statsCitiesLabel: "Ciudades",
    mapTitle: "Mapa de mercado",
    mapView: "Ver heatmap",
    mapMedian: "Mediana/m²",
    mapListings: "activos",
    features: [
      {
        title: "Dossiers por barrio",
        description:
          "Mediana de precio/m², tendencia mensual y mix de tipos — con tamaño de muestra visible en cada cifra.",
      },
      {
        title: "Scoring vs comparables",
        description:
          "Prioriza inmuebles con descuento relativo frente a vecinos del mismo estrato y tipo.",
      },
      {
        title: "Diagnóstico por URL",
        description:
          "Pega un enlace de Finca Raíz y recibe veredicto, banda de precio y contexto en segundos.",
      },
    ],
    journeysTitle: "Empieza aquí",
    journeys: [
      {
        title: "Investigar un barrio",
        description: "Mediana de precio/m², tendencias y mix de tipos por zona.",
        href: "/zones",
        cta: "Ver barrios",
      },
      {
        title: "Analizar un anuncio",
        description: "Pega una URL de Finca Raíz y recibe veredicto con comparables.",
        href: "/analyze-url",
        cta: "¿Buen precio?",
      },
      {
        title: "Encontrar oportunidades",
        description: "Ranking de publicaciones con descuento vs la mediana del barrio.",
        href: "/oportunidades",
        cta: "Ver oportunidades",
      },
    ],
  },
  en: {
    eyebrow: "Finca Raíz data · Colombia",
    heading: "Price per m² with neighborhood context — not just listings.",
    blurb:
      "Compare every listing against its zone median, estrato, and property type. Neighborhoods across Pereira, Medellín, Bogotá, and more — inventory refreshed periodically from Finca Raíz.",
    ctaPrimary: "Good deal?",
    ctaSecondary: "Browse neighborhoods",
    dealsLabel: "Recent opportunities",
    statsLoading: "Loading live data…",
    statsListingsLabel: "Listings analyzed",
    statsNeighborhoodsLabel: "Neighborhoods tracked",
    statsCitiesLabel: "Cities",
    mapTitle: "Market map",
    mapView: "Open heatmap",
    mapMedian: "Median/m²",
    mapListings: "active",
    features: [
      {
        title: "Neighborhood dossiers",
        description:
          "Median price/m², monthly trends, and property mix — with sample size shown on every figure.",
      },
      {
        title: "Comparable scoring",
        description:
          "Prioritize listings priced below neighbors of the same estrato and property type.",
      },
      {
        title: "URL diagnostics",
        description:
          "Paste a Finca Raíz link and get a verdict, price band, and context in seconds.",
      },
    ],
    journeysTitle: "Start here",
    journeys: [
      {
        title: "Research a neighborhood",
        description: "Median price/m², trends, and property mix by zone.",
        href: "/zones",
        cta: "Browse zones",
      },
      {
        title: "Analyze a listing",
        description: "Paste a Finca Raíz URL for a verdict with comparables.",
        href: "/analyze-url",
        cta: "Good deal?",
      },
      {
        title: "Find opportunities",
        description: "Ranked listings priced below neighborhood medians.",
        href: "/oportunidades",
        cta: "Deals",
      },
    ],
  },
}

type OpportunityCard = {
  id: string
  zone: string
  city: string
  type: string
  value: string
  pricePerM2: number | null
  refAvg: number | null
  score: string
  discountPct: number | null
  sampleSize: number | null
  imageUrl: string | null
  detailHref: string
  sourceHref: string
}

type Props = {
  locale?: Locale
  initialData?: HomePageData
}

const mapOpportunityCards = (
  opportunities: OpportunityRow[],
  lang: "es" | "en",
  localeFmt: string,
): OpportunityCard[] =>
  opportunities.map((o) => ({
    id: o.id,
    zone: o.neighborhood?.trim() || o.city,
    city: o.city,
    type: propertyTypeLabel(o.propertyType, lang),
    value: `COP ${Number(String(o.priceCop).replace(/\D/g, "")).toLocaleString(localeFmt)}`,
    pricePerM2: o.pricePerM2,
    refAvg: o.refAvgUsed,
    score:
      o.dealScore != null && Number.isFinite(o.dealScore)
        ? `${Math.round(o.dealScore)}/100`
        : "—",
    discountPct: o.discountVsRefPct,
    sampleSize: o.compSampleSize ?? null,
    imageUrl: o.imageUrl ?? null,
    detailHref: listingPath(lang, o.id),
    sourceHref: o.url,
  }))

export default function HomePage({ locale: pageLocale = "es", initialData }: Props) {
  const router = useRouter()
  const { lang, toggleLang } = useUiLang(pageLocale)
  const txt = uiText[lang]
  const copy = useMemo(() => content[lang], [lang])
  const localeFmt = lang === "es" ? "es-CO" : "en-US"
  const lp = (path: string) => localePath(lang, path)

  const [inlineUrl, setInlineUrl] = useState("")
  const [highlights, setHighlights] = useState<
    Array<{ label: string; value: string; loading: boolean }>
  >(() =>
    initialData
      ? [
          {
            label: copy.statsListingsLabel,
            value: initialData.totalListings.toLocaleString(localeFmt),
            loading: false,
          },
          {
            label: copy.statsNeighborhoodsLabel,
            value: initialData.neighborhoodCount.toLocaleString(localeFmt),
            loading: false,
          },
          {
            label: copy.statsCitiesLabel,
            value: initialData.cityCount.toLocaleString(localeFmt),
            loading: false,
          },
        ]
      : [
          { label: copy.statsListingsLabel, value: "", loading: true },
          { label: copy.statsNeighborhoodsLabel, value: "", loading: true },
          { label: copy.statsCitiesLabel, value: "", loading: true },
        ],
  )
  const [cards, setCards] = useState<OpportunityCard[]>(() =>
    initialData?.featuredOpportunities?.length
      ? mapOpportunityCards(initialData.featuredOpportunities, lang, localeFmt)
      : [],
  )
  const featuredCity = initialData?.featuredCity ?? "Pereira"
  const zonePreviews =
    initialData?.featuredZones.slice(0, 6).map((z) => ({
      name: z.displayName,
      href: lp(`/zones/${z.citySlug}/${z.slug}`),
      medianPricePerM2: z.medianPricePerM2,
      listingCount: z.listingCount,
    })) ?? []
  const [statsFailed, setStatsFailed] = useState(false)

  const lastUpdatedLabel = useMemo(() => {
    const raw = initialData?.lastScrapedAt
    if (!raw) return null
    return formatFreshnessDate(new Date(raw), localeFmt)
  }, [initialData?.lastScrapedAt, localeFmt])

  useEffect(() => {
    if (initialData) return

    let cancelled = false

    async function loadLiveData() {
      setStatsFailed(false)
      try {
        const [summaryRes, oppRes] = await Promise.all([
          fetch("/api/summary"),
          fetch(`/api/opportunities?city=${encodeURIComponent(DEFAULT_OPPORTUNITIES_CITY)}&limit=3`),
        ])
        if (!summaryRes.ok) {
          if (!cancelled) setStatsFailed(true)
          return
        }
        const summary = await summaryRes.json()
        if (cancelled) return

        setHighlights([
          {
            label: copy.statsListingsLabel,
            value: Number(summary.totalListings ?? 0).toLocaleString(localeFmt),
            loading: false,
          },
          {
            label: copy.statsNeighborhoodsLabel,
            value: Number(summary.neighborhoodCount ?? 0).toLocaleString(localeFmt),
            loading: false,
          },
          {
            label: copy.statsCitiesLabel,
            value: Number(summary.cityCount ?? 0).toLocaleString(localeFmt),
            loading: false,
          },
        ])

        if (oppRes.ok) {
          const oppJson = await oppRes.json()
          const opportunities = (oppJson.opportunities ?? []).slice(0, 3)
          if (!cancelled && opportunities.length > 0) {
            setCards(mapOpportunityCards(opportunities, lang, localeFmt))
          }
        }
      } catch {
        if (!cancelled) {
          setStatsFailed(true)
          setHighlights((prev) => prev.map((h) => ({ ...h, loading: false })))
        }
      }
    }

    void loadLiveData()
    return () => {
      cancelled = true
    }
  }, [copy, lang, localeFmt, initialData])

  const handleInlineAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inlineUrl.trim()
    if (!trimmed) return
    router.push(localeToolPath(lang, "/analyze-url", `url=${encodeURIComponent(trimmed)}`))
  }

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppHeader variant="marketing" homeHref={lp("/")} lang={lang} onToggleLang={toggleLang} />

      <main id="main-content" className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div>
            <Badge variant="default">{copy.eyebrow}</Badge>
            <h1 className="text-display mt-4 max-w-xl text-4xl font-semibold leading-[1.12] md:text-[2.75rem]">
              {copy.heading}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted md:text-lg">{copy.blurb}</p>
            {lastUpdatedLabel ? (
              <p className="mt-2 max-w-xl text-sm text-muted">
                {txt.dataFreshnessLabel}: <strong className="font-medium text-foreground">{lastUpdatedLabel}</strong>
                . {txt.dataFreshnessNote}
              </p>
            ) : null}

            <form
              onSubmit={handleInlineAnalyze}
              className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-stretch"
            >
              <label className="sr-only" htmlFor="home-analyze-url">
                {txt.homepageInlineAnalyze}
              </label>
              <input
                id="home-analyze-url"
                type="url"
                className={`${inputClassName} mt-0 flex-1`}
                placeholder="https://www.fincaraiz.com.co/..."
                value={inlineUrl}
                onChange={(e) => setInlineUrl(e.target.value)}
              />
              <Button type="submit" className="shrink-0">
                {txt.homepageInlineAnalyzeCta}
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button href={lp("/analyze-url")}>{copy.ctaPrimary}</Button>
              <Button href={lp("/zones")} variant="secondary">
                {copy.ctaSecondary}
              </Button>
              <Button href={lp("/price-drops")} variant="secondary">
                {txt.priceDropsNav}
              </Button>
            </div>

            <section className="mt-8" aria-labelledby="home-journeys-heading">
              <h2 id="home-journeys-heading" className="text-display text-lg font-semibold">
                {copy.journeysTitle}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {copy.journeys.map((journey) => (
                  <Link
                    key={journey.title}
                    href={lp(journey.href)}
                    className="surface-panel block p-4 transition hover:border-accent/35 hover:shadow-card-hover link-focus"
                  >
                    <h3 className="text-display text-sm font-semibold text-foreground">{journey.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{journey.description}</p>
                    <span className="mt-3 inline-flex text-xs font-semibold text-accent">{journey.cta} →</span>
                  </Link>
                ))}
              </div>
            </section>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.label} className="surface-inline p-3.5">
                  {item.loading ? (
                    <>
                      <Skeleton className="h-7 w-20" />
                      <Skeleton className="mt-2 h-3 w-full" />
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold tabular-nums text-foreground">{item.value || "—"}</p>
                      <p className="mt-0.5 text-meta">{item.label}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
            {statsFailed ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{txt.couldNotLoad}</p>
            ) : null}
          </div>

          <div className="relative z-10">
            <div className="surface-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-section-label">{copy.dealsLabel}</p>
                {cards.length > 0 ? (
                  <Link
                    href={lp("/oportunidades")}
                    className="text-xs font-semibold text-accent hover:underline link-focus"
                  >
                    {txt.nextStepsViewAllDeals} →
                  </Link>
                ) : null}
              </div>
              <div className="mt-3 space-y-3">
                {cards.length === 0 && !statsFailed ? (
                  <>
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </>
                ) : null}
                {cards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.detailHref}
                    className="flex gap-3 rounded-lg border border-border-subtle bg-elevated p-3 transition hover:border-accent/35 hover:shadow-sm link-focus"
                  >
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-surface">
                      {card.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl}
                          alt={card.zone}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted">—</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{card.zone}</p>
                          <p className="text-meta">
                            {card.city} · {card.type}
                          </p>
                        </div>
                        <Badge variant="good">{card.score}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{card.value}</p>
                      {card.pricePerM2 != null && card.refAvg != null ? (
                        <DealComparisonBar
                          subject={card.pricePerM2}
                          reference={card.refAvg}
                          locale={localeFmt}
                          className="mt-2"
                        />
                      ) : null}
                      {card.sampleSize != null ? (
                        <p className="mt-1 text-meta">n={card.sampleSize} comparables</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {initialData && initialData.featuredCities.length > 0 ? (
          <section className="mt-14" aria-labelledby="home-cities-heading">
            <h2 id="home-cities-heading" className="text-display text-xl font-semibold">
              {txt.homepageCitiesTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{txt.homepageCitiesHint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {initialData.featuredCities.map((c) => (
                <Link
                  key={c.slug}
                  href={lp(`/zones/${c.slug}`)}
                  className="rounded-lg border border-border-subtle bg-elevated px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-surface link-focus"
                  aria-label={`${c.name} — ${c.zoneCount} ${lang === "en" ? "neighborhoods" : "barrios"}`}
                >
                  {c.name} <span className="text-muted">({c.zoneCount})</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {initialData && initialData.featuredZones.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-display text-xl font-semibold">{txt.homepageFeaturedZones}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {initialData.featuredZones.slice(0, 3).map((z) => (
                <Link
                  key={z.slug}
                  href={lp(`/zones/${z.citySlug}/${z.slug}`)}
                  className="surface-inline block p-4 transition hover:border-accent/35 hover:shadow-sm"
                >
                  <p className="font-semibold text-foreground">{z.displayName}</p>
                  <p className="mt-1 text-meta">
                    {z.listingCount.toLocaleString(localeFmt)} {txt.activeListings.toLowerCase()}
                  </p>
                  {z.medianPricePerM2 != null ? (
                    <p className="mt-2 text-sm font-semibold tabular-nums">
                      {txt.medianPriceM2}: ${Math.round(z.medianPricePerM2).toLocaleString(localeFmt)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold text-accent">{txt.viewBarrioDossier}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {zonePreviews.length > 0 ? (
          <section className="mt-14">
            <CartographicPreview
              cityName={featuredCity}
              zones={zonePreviews}
              locale={localeFmt}
              heatmapHref={lp("/heatmap")}
              labels={{
                title: copy.mapTitle,
                viewMap: copy.mapView,
                median: copy.mapMedian,
                listings: copy.mapListings,
              }}
            />
          </section>
        ) : null}

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {copy.features.map((feature) => (
            <Card key={feature.title} tier="inline">
              <h2 className="text-display text-base font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
            </Card>
          ))}
        </section>
      </main>

      <PageFooter />
    </div>
  )
}
