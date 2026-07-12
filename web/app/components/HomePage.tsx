"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import MarketingHeader from "@/app/components/MarketingHeader"
import PageFooter from "@/app/components/PageFooter"
import Badge from "@/app/components/ui/Badge"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import type { HomePageData } from "@/lib/getHomeStats"
import { localePath, type Locale } from "@/lib/locale"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import { uiText } from "@/lib/i18n"
import { useUiLang } from "@/lib/useUiLang"
import { useUiTheme } from "@/lib/useUiTheme"

type Content = {
  badge: string
  heading: string
  blurb: string
  ctaPrimary: string
  ctaSecondary: string
  cardsLabel: string
  statsLoading: string
  statsListingsLabel: string
  statsNeighborhoodsLabel: string
  statsCitiesLabel: string
  features: Array<{ title: string; description: string }>
}

const content: Record<"es" | "en", Content> = {
  es: {
    badge: "Plataforma premium para inversionistas",
    heading: "Detecta propiedades infravaloradas antes que el mercado.",
    blurb:
      "Habidata integra datos de anuncios, contexto geoespacial y scoring de oportunidad en una experiencia de analitica clara y accionable.",
    ctaPrimary: "Analizar anuncio ahora",
    ctaSecondary: "Calcular precio sugerido",
    cardsLabel: "Vista previa de oportunidades",
    statsLoading: "Cargando datos…",
    statsListingsLabel: "Anuncios analizados",
    statsNeighborhoodsLabel: "Barrios cubiertos",
    statsCitiesLabel: "Ciudades activas",
    features: [
      {
        title: "Heatmaps de mercado",
        description:
          "Visualiza zonas de demanda y variacion de precio en capas faciles de interpretar.",
      },
      {
        title: "Scoring de oportunidad",
        description:
          "Prioriza inmuebles con mejor descuento relativo usando comparables locales.",
      },
      {
        title: "Diagnostico express por URL",
        description:
          "Pega un anuncio y recibe contexto de precio, riesgo y potencial en segundos.",
      },
    ],
  },
  en: {
    badge: "Premium platform for investors",
    heading: "Spot undervalued properties before the market does.",
    blurb:
      "Habidata combines listing data, geospatial context, and deal scoring into one clear, actionable analytics experience.",
    ctaPrimary: "Analyze listing now",
    ctaSecondary: "Calculate price range",
    cardsLabel: "Opportunity preview",
    statsLoading: "Loading live data…",
    statsListingsLabel: "Listings analyzed",
    statsNeighborhoodsLabel: "Neighborhoods covered",
    statsCitiesLabel: "Active cities",
    features: [
      {
        title: "Market heatmaps",
        description:
          "Visualize demand zones and price variation with layers that are easy to read.",
      },
      {
        title: "Opportunity scoring",
        description:
          "Prioritize listings with stronger relative discount from local comparables.",
      },
      {
        title: "Instant URL diagnostics",
        description:
          "Paste a listing and get price context, risk, and upside potential in seconds.",
      },
    ],
  },
}

type ZonePreview = {
  slug: string
  displayName: string
  citySlug: string
  medianPricePerM2: number | null
  listingCount: number
}

type Props = {
  locale?: Locale;
  initialData?: HomePageData;
};

export default function HomePage({ locale: pageLocale = "es", initialData }: Props) {
  const router = useRouter()
  const { lang, toggleLang } = useUiLang(pageLocale)
  const { theme, toggleTheme } = useUiTheme("light")
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
  const [cards, setCards] = useState<
    Array<{ zone: string; type: string; value: string; score: string; href: string }>
  >([])
  const zonePreviews: ZonePreview[] =
    initialData?.featuredZones.slice(0, 3).map((z) => ({
      slug: z.slug,
      displayName: z.displayName,
      citySlug: z.citySlug,
      medianPricePerM2: z.medianPricePerM2,
      listingCount: z.listingCount,
    })) ?? []
  const [statsFailed, setStatsFailed] = useState(false)

  useEffect(() => {
    if (initialData) return
    let cancelled = false

    async function loadLiveData() {
      setStatsFailed(false)
      try {
        const [summaryRes, oppRes] = await Promise.all([
          fetch("/api/summary"),
          fetch("/api/opportunities"),
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
            setCards(
              opportunities.map(
                (o: {
                  neighborhood: string | null
                  city: string
                  propertyType: string | null
                  priceCop: string
                  dealScore: number | null
                  url: string
                }) => ({
                  zone: o.neighborhood?.trim() || o.city,
                  type: propertyTypeLabel(o.propertyType, lang),
                  value: `COP ${Number(String(o.priceCop).replace(/\D/g, "")).toLocaleString(localeFmt)}`,
                  score:
                    o.dealScore != null && Number.isFinite(o.dealScore)
                      ? `${Math.round(o.dealScore)}/100`
                      : "—",
                  href: o.url,
                }),
              ),
            )
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
    router.push(`/analyze-url?url=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <MarketingHeader
        lang={lang}
        homeHref={lp("/")}
        onToggleLang={toggleLang}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-up">
            <Badge>{copy.badge}</Badge>
            <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
              {copy.heading}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{copy.blurb}</p>

            <form
              onSubmit={handleInlineAnalyze}
              className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <label className="sr-only" htmlFor="home-analyze-url">
                {txt.homepageInlineAnalyze}
              </label>
              <input
                id="home-analyze-url"
                type="url"
                className={`${inputClassName} flex-1`}
                placeholder="https://www.fincaraiz.com.co/..."
                value={inlineUrl}
                onChange={(e) => setInlineUrl(e.target.value)}
              />
              <Button type="submit" className="shrink-0">
                {txt.homepageInlineAnalyzeCta}
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/analyze-url">{copy.ctaPrimary}</Button>
              <Button href="/estimate" variant="secondary">
                {copy.ctaSecondary}
              </Button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <Card key={item.label} className="rounded-xl p-4">
                  {item.loading ? (
                    <>
                      <Skeleton className="h-7 w-20" />
                      <Skeleton className="mt-2 h-3 w-full" />
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-bold tabular-nums text-foreground">
                        {item.value || "—"}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                        {item.label}
                      </p>
                    </>
                  )}
                </Card>
              ))}
            </div>
            {statsFailed ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                {txt.couldNotLoad}
              </p>
            ) : null}
          </div>

          <aside className="animate-fade-up-delay premium-surface rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {copy.cardsLabel}
            </p>
            <div className="mt-4 space-y-3">
              {cards.length === 0 && !statsFailed ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : null}
              {cards.map((card) => (
                <a
                  key={`${card.zone}-${card.type}-${card.value}`}
                  href={card.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-200/90 bg-elevated p-4 transition hover:border-teal-300 dark:border-slate-700/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{card.zone}</p>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {card.score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{card.type}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {card.value}
                  </p>
                </a>
              ))}
            </div>
          </aside>
        </div>

        {initialData && initialData.featuredCities.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-lg font-semibold text-foreground">
              {lang === "en" ? "Explore by city" : "Explorar por ciudad"}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {initialData.featuredCities.map((c) => (
                <Link
                  key={c.slug}
                  href={lp(`/zones/${c.slug}`)}
                  className="rounded-full border border-slate-200/90 bg-elevated px-4 py-2 text-sm font-semibold text-foreground transition hover:border-teal-300 dark:border-slate-700/80"
                >
                  {c.name}{" "}
                  <span className="text-muted">({c.zoneCount})</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {zonePreviews.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-lg font-semibold text-foreground">
              {txt.homepageFeaturedZones}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {zonePreviews.map((z) => (
                <Link
                  key={z.slug}
                  href={lp(`/zones/${z.citySlug}/${z.slug}`)}
                  className="rounded-xl border border-slate-200/90 bg-elevated p-4 transition hover:border-teal-300 dark:border-slate-700/80"
                >
                  <p className="font-semibold text-foreground">{z.displayName}</p>
                  <p className="mt-1 text-sm text-muted">
                    {z.listingCount.toLocaleString(localeFmt)} {txt.activeListings.toLowerCase()}
                  </p>
                  {z.medianPricePerM2 != null ? (
                    <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                      {txt.medianPriceM2}: ${Math.round(z.medianPricePerM2).toLocaleString(localeFmt)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold text-accent">
                    {txt.viewBarrioDossier}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-12 sm:px-6 md:grid-cols-3">
        {copy.features.map((feature) => (
          <Card key={feature.title} className="animate-fade-up-delay-2">
            <h2 className="text-lg font-semibold text-foreground">{feature.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{feature.description}</p>
          </Card>
        ))}
      </section>
      <PageFooter locale={lang} />
    </div>
  )
}
