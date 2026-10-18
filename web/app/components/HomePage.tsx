"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import AppHeader from "@/app/components/AppHeader"
import DealComparisonBar from "@/app/components/DealComparisonBar"
import ListingThumbnail from "@/app/components/ListingThumbnail"
import PageFooter from "@/app/components/PageFooter"
import Button from "@/app/components/ui/Button"
import Badge from "@/app/components/ui/Badge"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import { nearestCityFromCoords } from "@/lib/cityCenters"
import { cityDisplayName } from "@/lib/cityNames"
import type { HomePageData } from "@/lib/getHomeStats"
import { formatFreshnessDate } from "@/lib/getDataFreshness"
import {
  DEFAULT_OPPORTUNITIES_CITY,
  type OpportunityRow,
} from "@/lib/getTopOpportunities"
import { listingPath, localePath, localeToolPath, opportunitiesPath, type Locale } from "@/lib/locale"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import { uiText } from "@/lib/i18n"
import { useUiLang } from "@/lib/useUiLang"

const HOME_CITY_STORAGE_KEY = "claracasas-home-city"
/** Only switch from Pereira if GPS is within this distance of a catalog city. */
const MAX_GEO_CITY_DISTANCE_M = 80_000

type Content = {
  heading: string
  blurb: string
  statsListingsLabel: string
  statsNeighborhoodsLabel: string
  statsCitiesLabel: string
}

const content: Record<"es" | "en", Content> = {
  es: {
    heading: "¿Este anuncio está bien de precio para el barrio?",
    blurb:
      "Inteligencia de precios de aviso en Colombia. Elige cómo empezar — no tasaciones ni ventas cerradas.",
    statsListingsLabel: "Anuncios analizados",
    statsNeighborhoodsLabel: "Barrios con datos",
    statsCitiesLabel: "Ciudades",
  },
  en: {
    heading: "Is this listing fairly priced for the neighborhood?",
    blurb:
      "Listing-price intelligence for Colombia. Pick how to start — not appraisals or closed sales.",
    statsListingsLabel: "Listings analyzed",
    statsNeighborhoodsLabel: "Neighborhoods tracked",
    statsCitiesLabel: "Cities",
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
}

type Props = {
  locale?: Locale
}

const mapOpportunityCards = (
  opportunities: OpportunityRow[],
  lang: "es" | "en",
  localeFmt: string,
): OpportunityCard[] =>
  opportunities.map((o) => ({
    id: o.id,
    zone:
      (o.neighborhood?.trim() && o.neighborhood.trim().toLowerCase() !== o.city.trim().toLowerCase()
        ? o.neighborhood.trim()
        : o.zoneName?.trim()) || cityDisplayName(o.city),
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
  }))

const fmtTemplate = (template: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template,
  )

const readStoredCity = (): string => {
  if (typeof window === "undefined") return DEFAULT_OPPORTUNITIES_CITY
  try {
    const raw = localStorage.getItem(HOME_CITY_STORAGE_KEY)?.trim()
    return raw || DEFAULT_OPPORTUNITIES_CITY
  } catch {
    return DEFAULT_OPPORTUNITIES_CITY
  }
}

const persistCity = (city: string) => {
  try {
    localStorage.setItem(HOME_CITY_STORAGE_KEY, city)
  } catch {
    /* ignore */
  }
}

export default function HomePage({ locale: pageLocale = "es" }: Props) {
  const router = useRouter()
  const { lang, toggleLang } = useUiLang(pageLocale)
  const txt = uiText[lang]
  const copy = useMemo(() => content[lang], [lang])
  const localeFmt = lang === "es" ? "es-CO" : "en-US"
  const lp = (path: string) => localePath(lang, path)

  const [inlineUrl, setInlineUrl] = useState("")
  const [city, setCity] = useState(DEFAULT_OPPORTUNITIES_CITY)
  const [data, setData] = useState<HomePageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsFailed, setStatsFailed] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  const cards = useMemo(
    () =>
      data?.featuredOpportunities?.length
        ? mapOpportunityCards(data.featuredOpportunities, lang, localeFmt)
        : [],
    [data?.featuredOpportunities, lang, localeFmt],
  )
  const topDeal = cards[0] ?? null
  const recentCards = cards.slice(1)
  const cityOptions = useMemo(() => {
    const names = (data?.featuredCities ?? []).map((c) => c.name)
    return names.includes(city) ? names : [city, ...names]
  }, [data?.featuredCities, city])

  const lastUpdatedLabel = useMemo(() => {
    const raw = data?.lastScrapedAt
    if (!raw) return null
    return formatFreshnessDate(new Date(raw), localeFmt)
  }, [data?.lastScrapedAt, localeFmt])

  const loadHomeData = useCallback(
    async (forCity: string) => {
      setLoading(true)
      setStatsFailed(false)
      try {
        const res = await fetch(`/api/home?city=${encodeURIComponent(forCity)}`)
        if (!res.ok) {
          setStatsFailed(true)
          setData(null)
          return
        }
        const json = (await res.json()) as HomePageData
        setData(json)
        setCity(json.featuredCity)
        persistCity(json.featuredCity)
      } catch {
        setStatsFailed(true)
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const stored = readStoredCity()
    setCity(stored)
    void loadHomeData(stored)
  }, [loadHomeData])

  const applyCoords = useCallback(
    (lat: number, lng: number) => {
      const nearest = nearestCityFromCoords(lat, lng)
      if (!nearest || nearest.distanceM > MAX_GEO_CITY_DISTANCE_M) return
      if (nearest.city === city) return
      void loadHomeData(nearest.city)
    },
    [city, loadHomeData],
  )

  const handleUseLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude)
        setGeoLoading(false)
      },
      () => {
        setGeoLoading(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 86_400_000 },
    )
  }, [applyCoords])

  /** Quiet upgrade: only if permission already granted (no prompt). */
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    let cancelled = false

    const run = async () => {
      try {
        const permissions = navigator.permissions
        if (!permissions?.query) return
        const status = await permissions.query({ name: "geolocation" })
        if (cancelled || status.state !== "granted") return
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) {
              applyCoords(pos.coords.latitude, pos.coords.longitude)
            }
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 86_400_000 },
        )
      } catch {
        /* permissions API unsupported */
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [applyCoords])

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    if (next && next !== city) void loadHomeData(next)
  }

  const handleInlineAnalyze = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inlineUrl.trim()
    if (!trimmed) return
    router.push(localeToolPath(lang, "/analyze-url", `url=${encodeURIComponent(trimmed)}`))
  }

  const highlights = data
    ? [
        {
          label: copy.statsListingsLabel,
          value: data.totalListings.toLocaleString(localeFmt),
        },
        {
          label: copy.statsNeighborhoodsLabel,
          value: data.neighborhoodCount.toLocaleString(localeFmt),
        },
        {
          label: copy.statsCitiesLabel,
          value: data.cityCount.toLocaleString(localeFmt),
        },
      ]
    : []

  const statsLine = highlights.map((h) => `${h.value} ${h.label.toLowerCase()}`).join(" · ")
  const opportunitiesHref = opportunitiesPath(lang, `city=${encodeURIComponent(city)}`)

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppHeader variant="marketing" homeHref={lp("/")} lang={lang} onToggleLang={toggleLang} />

      <main id="main-content" className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <h1 className="text-display max-w-3xl text-3xl font-semibold leading-snug text-foreground sm:text-4xl md:text-[2.75rem]">
          {copy.heading}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{copy.blurb}</p>
        <p className="mt-3 text-sm text-muted">
          {txt.homepageTrustStrip}{" "}
          <Link href={lp("/methodology")} className="font-medium text-accent hover:underline link-focus">
            {txt.homepageTrustMethodology}
          </Link>
          {lastUpdatedLabel ? (
            <>
              {" "}
              · {txt.dataFreshnessLabel}:{" "}
              <strong className="font-medium text-foreground">{lastUpdatedLabel}</strong>
            </>
          ) : null}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
          <div className="flex flex-col rounded-2xl border-2 border-accent/35 bg-elevated/80 p-5 sm:p-6">
            <h2 className="text-display text-xl font-semibold">{txt.homepageDoorAnalyzeTitle}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{txt.homepageDoorAnalyzeHint}</p>
            <form onSubmit={handleInlineAnalyze} className="mt-5 flex flex-col gap-2">
              <label className="sr-only" htmlFor="home-analyze-url">
                {txt.homepageInlineAnalyze}
              </label>
              <input
                id="home-analyze-url"
                type="url"
                className={`${inputClassName} mt-0`}
                placeholder={txt.analyzeUrlPlaceholder}
                value={inlineUrl}
                onChange={(e) => setInlineUrl(e.target.value)}
              />
              <Button type="submit" className="w-full">
                {txt.homepageInlineAnalyzeCta}
              </Button>
            </form>
          </div>

          <div className="flex flex-col rounded-2xl border-2 border-accent-secondary/35 bg-elevated/80 p-5 sm:p-6">
            <h2 className="text-display text-xl font-semibold">{txt.homepageDoorDealsTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{txt.homepageDoorDealsHint}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <label htmlFor="home-city" className="sr-only">
                {txt.homepageCitySelectLabel}
              </label>
              <select
                id="home-city"
                value={city}
                onChange={handleCityChange}
                disabled={loading}
                className="rounded-md border border-border-subtle bg-background px-2 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
              >
                {cityOptions.map((name) => (
                  <option key={name} value={name}>
                    {cityDisplayName(name)}
                  </option>
                ))}
              </select>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={handleUseLocation}
                disabled={geoLoading}
                title={txt.homepageLocationHint}
                className="font-semibold text-accent hover:underline disabled:opacity-60 link-focus"
              >
                {geoLoading ? "…" : txt.homepageUseLocation}
              </button>
            </div>

            <div className="mt-5 flex-1">
              {topDeal ? (
                <Link
                  href={topDeal.detailHref}
                  className="flex gap-3 rounded-xl border border-border-subtle/80 bg-background/60 p-3 transition hover:border-accent/35 link-focus"
                >
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-surface">
                    {topDeal.imageUrl ? (
                      <ListingThumbnail
                        src={topDeal.imageUrl}
                        alt={topDeal.zone}
                        width={80}
                        height={64}
                        sizes="80px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted">—</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{topDeal.zone}</p>
                        <p className="text-meta">
                          {cityDisplayName(topDeal.city)} · {topDeal.type}
                        </p>
                      </div>
                      <Badge variant="good">{topDeal.score}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{topDeal.value}</p>
                    {topDeal.discountPct != null && topDeal.discountPct > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-deal-good">
                        {fmtTemplate(txt.homepageDiscountVsComps, {
                          pct: String(Math.round(topDeal.discountPct)),
                        })}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ) : loading ? (
                <Skeleton className="h-24 w-full" />
              ) : data ? (
                <p className="rounded-xl border border-border-subtle/80 bg-background/60 p-3 text-sm text-muted">
                  {fmtTemplate(txt.homepageNoCleanDeals, { city: cityDisplayName(city) })}
                </p>
              ) : null}
            </div>

            <Button href={opportunitiesHref} variant="secondary" className="mt-4 w-full">
              {txt.homepageDoorDealsCta}
            </Button>
          </div>
        </div>

        <section className="mt-16" aria-labelledby="home-proof-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="home-proof-heading" className="text-display text-xl font-semibold">
                {txt.homepageProofTitle}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {txt.homepageProofHint}{" "}
                <span className="text-foreground/80">
                  ({fmtTemplate(txt.homepageCityLabel, { city: cityDisplayName(city) })})
                </span>
              </p>
              {loading && !statsLine ? (
                <Skeleton className="mt-2 h-3 w-64" />
              ) : statsLine ? (
                <p className="mt-2 text-xs tabular-nums text-muted">{statsLine}</p>
              ) : null}
            </div>
            {cards.length > 0 ? (
              <Link
                href={opportunitiesHref}
                className="text-sm font-semibold text-accent hover:underline link-focus"
              >
                {txt.nextStepsViewAllDeals} →
              </Link>
            ) : null}
          </div>
          {statsFailed ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{txt.couldNotLoad}</p>
          ) : null}
          <div className="mt-6 divide-y divide-border-subtle/60 border-y border-border-subtle/60">
            {loading && cards.length === 0 ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : null}
            {recentCards.map((card) => (
              <Link
                key={card.id}
                href={card.detailHref}
                className="flex gap-3 py-4 transition hover:bg-elevated/40 link-focus"
              >
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-surface">
                  {card.imageUrl ? (
                    <ListingThumbnail
                      src={card.imageUrl}
                      alt={card.zone}
                      width={80}
                      height={64}
                      sizes="80px"
                      className="h-full w-full object-cover"
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
                        {cityDisplayName(card.city)} · {card.type}
                      </p>
                    </div>
                    <Badge variant="good">{card.score}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{card.value}</p>
                  {card.discountPct != null &&
                  card.discountPct > 0 &&
                  (card.pricePerM2 == null || card.refAvg == null) ? (
                    <p className="mt-0.5 text-xs font-medium text-deal-good">
                      {fmtTemplate(txt.homepageDiscountVsComps, {
                        pct: String(Math.round(card.discountPct)),
                      })}
                    </p>
                  ) : null}
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
        </section>

        {data && (data.featuredCities.length > 0 || data.featuredZones.length > 0) ? (
          <section className="mt-16" aria-labelledby="home-explore-heading">
            <h2 id="home-explore-heading" className="text-display text-xl font-semibold">
              {txt.homepageCitiesTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{txt.homepageCitiesHint}</p>

            {data.featuredCities.length > 0 ? (
              <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-sm">
                {data.featuredCities.map((c, i) => (
                  <span key={c.slug} className="inline-flex items-baseline gap-x-3">
                    {i > 0 ? <span className="text-muted/50" aria-hidden>·</span> : null}
                    <Link
                      href={lp(`/zones/${c.slug}`)}
                      className={`font-medium link-focus ${
                        c.name === city ? "text-accent" : "text-foreground hover:text-accent"
                      }`}
                      aria-label={`${cityDisplayName(c.name)} — ${c.zoneCount} ${lang === "en" ? "neighborhoods" : "barrios"}`}
                    >
                      {cityDisplayName(c.name)}{" "}
                      <span className="font-normal text-muted">({c.zoneCount})</span>
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}

            {data.featuredZones.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {data.featuredZones.slice(0, 3).map((z) => (
                  <li key={z.slug}>
                    <Link
                      href={lp(`/zones/${z.citySlug}/${z.slug}`)}
                      className="group flex flex-wrap items-baseline justify-between gap-2 link-focus"
                    >
                      <span className="font-semibold text-foreground group-hover:text-accent">
                        {z.displayName}
                      </span>
                      <span className="text-meta">
                        {z.listingCount.toLocaleString(localeFmt)} {txt.activeListings.toLowerCase()}
                        {z.medianPricePerM2 != null
                          ? ` · ${txt.medianPriceM2} $${Math.round(z.medianPricePerM2).toLocaleString(localeFmt)}`
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : loading ? (
          <section className="mt-16">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-3 h-4 w-full max-w-md" />
          </section>
        ) : null}
      </main>

      <PageFooter />
    </div>
  )
}
