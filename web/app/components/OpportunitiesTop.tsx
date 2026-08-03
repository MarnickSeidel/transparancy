"use client"
import dynamic from "next/dynamic"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"

import PageFooter from "@/app/components/PageFooter"
import EmailSignupForm from "@/app/components/EmailSignupForm"
import ToolNextSteps from "@/app/components/ToolNextSteps"
import CollapsibleSection from "@/app/components/CollapsibleSection"
import OpportunityMobileCard from "@/app/components/OpportunityMobileCard"
import ListingThumbnail from "@/app/components/ListingThumbnail"
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import SiteHeader from "@/app/components/SiteHeader"
import WhyDealPanel from "@/app/components/WhyDealPanel"
import { fetchJsonCached } from "@/lib/clientFetchCache"
import type { FiltersData } from "@/lib/getFiltersData"
import { formatDomDays } from "@/lib/formatDom"
import type { WhyDeal } from "@/lib/dealEngine"
import {
  DEFAULT_OPPORTUNITIES_CITY,
  DEFAULT_OPPORTUNITIES_PAGE_SIZE,
} from "@/lib/getTopOpportunities"
import { listingPath } from "@/lib/locale"
import { buildListingContextLinks } from "@/lib/listingContextLinks"
import { uiText } from "@/lib/i18n"
import { propertyTypeOptions } from "@/lib/propertyTypes"
import { useUiLang } from "@/lib/useUiLang"

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-lg bg-surface" />,
})

type OpportunityRow = {
  id: string
  title: string
  city: string
  neighborhood: string | null
  zoneName?: string | null
  priceCop: string
  areaM2: number
  pricePerM2: number | null
  metricType?: "private" | "built" | "terrain" | "generic"
  refAvgUsed: number | null
  compSampleSize?: number
  compMethod?: string
  dealScore: number | null
  whyDeal?: WhyDeal | null
  discountVsRefPct: number | null
  confidence?: "high" | "medium" | "low"
  confidenceReasons?: string[]
  priceDropPct?: number | null
  domDays?: number | null
  priceTimeline?: Array<{ recordedAt: string; priceCop: string }>
  acceptsBarter?: boolean
  isProject?: boolean
  url: string
  sourceUpdatedAt: string | null
  imageUrl?: string | null
  latitude?: number | null
  longitude?: number | null
}

type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

type SortBy = "dealScore" | "discount" | "price" | "confidence"

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

function confidenceLabel(
  c: OpportunityRow["confidence"] | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (c === "high") return txt.confidenceHigh
  if (c === "medium") return txt.confidenceMedium
  if (c === "low") return txt.confidenceLow
  return "—"
}

function signalTags(
  row: OpportunityRow,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
  lang: "es" | "en",
) {
  const tags: string[] = []
  if (row.acceptsBarter) tags.push(txt.opportunitiesFlagBarter)
  if (row.isProject) tags.push(txt.opportunitiesFlagProject)
  if (row.priceDropPct != null && row.priceDropPct >= 2) {
    tags.push(txt.opportunitiesFlagPriceDrop.replace("{pct}", row.priceDropPct.toFixed(0)))
  }
  if (row.domDays != null && row.domDays >= 45) {
    tags.push(formatDomDays(row.domDays, lang === "es" ? "es" : "en") ?? "")
  }
  return tags
}

function initialOppParam(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const v = new URLSearchParams(window.location.search).get(name)?.trim()
  return v && v.length > 0 && v !== "all" ? v : fallback
}

type SimilarFilters = {
  minAreaM2: string
  maxAreaM2: string
  minPriceCop: string
  maxPriceCop: string
  latitude: string
  longitude: string
  radiusMeters: string
  estrato: string
  conjunto: string
}

function initialSimilarFilters(): SimilarFilters | null {
  if (typeof window === "undefined") return null
  const p = new URLSearchParams(window.location.search)
  if (p.get("similar") !== "1") return null
  return {
    minAreaM2: p.get("minAreaM2") ?? "",
    maxAreaM2: p.get("maxAreaM2") ?? "",
    minPriceCop: p.get("minPriceCop") ?? "",
    maxPriceCop: p.get("maxPriceCop") ?? "",
    latitude: p.get("latitude") ?? "",
    longitude: p.get("longitude") ?? "",
    radiusMeters: p.get("radiusMeters") ?? "",
    estrato: p.get("estrato") ?? "",
    conjunto: p.get("conjunto") ?? "",
  }
}

export default function OpportunitiesTop({
  initialFilters,
}: {
  initialFilters?: FiltersData
}) {
  const { lang, toggleLang } = useUiLang("es")
  const txt = uiText[lang]
  const locale = lang === "es" ? "es-CO" : "en-US"

  const [cities, setCities] = useState<string[]>(initialFilters?.cities ?? [])
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    initialFilters?.neighborhoods ?? [],
  )
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    initialFilters?.propertyTypes ?? [],
  )
  const [city, setCity] = useState(() =>
    initialOppParam("city", DEFAULT_OPPORTUNITIES_CITY),
  )
  const [neighborhood, setNeighborhood] = useState(() =>
    initialOppParam("neighborhood", "all"),
  )
  const [propertyType, setPropertyType] = useState(() =>
    initialOppParam("propertyType", "all"),
  )
  const [excludedNeighborhoods, setExcludedNeighborhoods] = useState<string[]>([])
  const [excludeDraft, setExcludeDraft] = useState("")
  const [maxPriceCop, setMaxPriceCop] = useState(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.search).get("maxPriceCop")?.trim() ?? ""
  })
  const [minAreaM2, setMinAreaM2] = useState(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.search).get("minAreaM2")?.trim() ?? ""
  })
  const [maxAreaM2, setMaxAreaM2] = useState(() => {
    if (typeof window === "undefined") return ""
    return new URLSearchParams(window.location.search).get("maxAreaM2")?.trim() ?? ""
  })
  const [similarFilters, setSimilarFilters] = useState<SimilarFilters | null>(
    () => initialSimilarFilters(),
  )
  const [minDiscountPct, setMinDiscountPct] = useState("")
  const [excludeBarter, setExcludeBarter] = useState(false)
  const [excludeProjects, setExcludeProjects] = useState(false)
  const [excludeUnknownNeighborhoods, setExcludeUnknownNeighborhoods] =
    useState(false)
  const [hideLowConfidence, setHideLowConfidence] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>("dealScore")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<OpportunityRow[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: DEFAULT_OPPORTUNITIES_PAGE_SIZE,
    total: 0,
    hasMore: false,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const excludeSuggestions = useMemo(() => {
    const q = excludeDraft.trim().toLowerCase()
    if (!q) return []
    return neighborhoods
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 40)
  }, [neighborhoods, excludeDraft])

  const opportunitiesQs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("city", city)
    if (propertyType !== "all" && propertyType.trim()) {
      p.set("propertyType", propertyType.trim())
    }
    if (neighborhood !== "all" && neighborhood.trim()) {
      p.set("neighborhood", neighborhood.trim())
    }
    for (const ex of excludedNeighborhoods) {
      const t = ex.trim()
      if (t) p.append("excludeNeighborhood", t)
    }
    const maxDigits = maxPriceCop.replace(/\D/g, "")
    const maxParsed = maxDigits ? Number.parseInt(maxDigits, 10) : Number.NaN
    if (Number.isFinite(maxParsed) && maxParsed >= 1) {
      p.set("maxPriceCop", String(maxParsed))
    }
    const minAreaDigits = minAreaM2.replace(/\D/g, "")
    const minAreaParsed = minAreaDigits ? Number.parseInt(minAreaDigits, 10) : Number.NaN
    if (Number.isFinite(minAreaParsed) && minAreaParsed >= 1) {
      p.set("minAreaM2", String(minAreaParsed))
    }
    const maxAreaDigits = maxAreaM2.replace(/\D/g, "")
    const maxAreaParsed = maxAreaDigits ? Number.parseInt(maxAreaDigits, 10) : Number.NaN
    if (Number.isFinite(maxAreaParsed) && maxAreaParsed >= 1) {
      p.set("maxAreaM2", String(maxAreaParsed))
    }
    if (similarFilters) {
      p.set("similar", "1")
      if (similarFilters.minAreaM2 && !minAreaM2.trim()) {
        p.set("minAreaM2", similarFilters.minAreaM2)
      }
      if (similarFilters.maxAreaM2 && !maxAreaM2.trim()) {
        p.set("maxAreaM2", similarFilters.maxAreaM2)
      }
      if (similarFilters.minPriceCop) p.set("minPriceCop", similarFilters.minPriceCop)
      if (similarFilters.maxPriceCop && !maxPriceCop.trim()) {
        p.set("maxPriceCop", similarFilters.maxPriceCop)
      }
      if (similarFilters.latitude) p.set("latitude", similarFilters.latitude)
      if (similarFilters.longitude) p.set("longitude", similarFilters.longitude)
      if (similarFilters.radiusMeters) p.set("radiusMeters", similarFilters.radiusMeters)
      if (similarFilters.estrato) p.set("estrato", similarFilters.estrato)
      if (similarFilters.conjunto) p.set("conjunto", similarFilters.conjunto)
    }
    const minDisc = minDiscountPct.trim()
    if (minDisc !== "") {
      const parsed = Number.parseFloat(minDisc)
      if (Number.isFinite(parsed) && parsed >= 0) {
        p.set("minDiscountPct", String(parsed))
      }
    }
    if (excludeBarter) p.set("excludeBarter", "1")
    if (excludeProjects) p.set("excludeProjects", "1")
    if (excludeUnknownNeighborhoods) p.set("excludeUnknownNeighborhoods", "1")
    if (!hideLowConfidence) p.set("hideLowConfidence", "0")
    p.set("page", String(page))
    p.set("pageSize", String(DEFAULT_OPPORTUNITIES_PAGE_SIZE))
    p.set("sortBy", sortBy)
    return `?${p.toString()}`
  }, [
    city,
    excludeBarter,
    excludeProjects,
    excludeUnknownNeighborhoods,
    excludedNeighborhoods,
    hideLowConfidence,
    maxAreaM2,
    maxPriceCop,
    minAreaM2,
    minDiscountPct,
    neighborhood,
    page,
    propertyType,
    similarFilters,
    sortBy,
  ])

  const nextSteps = useMemo(() => {
    const links = buildListingContextLinks({
      lang,
      city,
      neighborhood: neighborhood !== "all" ? neighborhood : null,
      propertyType: propertyType !== "all" ? propertyType : null,
    })
    return [
      {
        title: txt.nextStepsAnalyzeTitle,
        description: txt.nextStepsAnalyzeDesc,
        href: links.analyzeHref,
        cta: txt.analyzeUrlNav,
      },
      {
        title: txt.nextStepsExploreTitle,
        description: txt.nextStepsExploreDesc,
        href: links.exploreHref,
        cta: txt.exploreNav,
      },
      {
        title: txt.nextStepsHeatmapTitle,
        description: txt.nextStepsHeatmapDesc,
        href: links.heatmapHref,
        cta: txt.heatmapNav,
      },
    ]
  }, [city, lang, neighborhood, propertyType, txt])

  const clearSimilarFilters = () => {
    setSimilarFilters(null)
    setMaxPriceCop("")
    setMinAreaM2("")
    setMaxAreaM2("")
    setPage(1)
  }

  const addExcludedFromDraft = useCallback(() => {
    const t = excludeDraft.trim()
    if (!t) return
    setExcludedNeighborhoods((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t],
    )
    setExcludeDraft("")
    setPage(1)
  }, [excludeDraft])

  useEffect(() => {
    let cancelled = false
    void fetchJsonCached<{ cities?: string[] }>("/api/filters")
      .then((json) => {
        if (!cancelled) setCities(json.cities ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const filtersUrl = `/api/filters?city=${encodeURIComponent(city)}`
      const [fJson, oJson] = await Promise.all([
        fetchJsonCached<{
          cities?: string[]
          neighborhoods?: string[]
          propertyTypes?: string[]
        }>(filtersUrl),
        fetchJsonCached<{
          opportunities?: OpportunityRow[]
          pagination?: PaginationMeta
        }>(`/api/opportunities${opportunitiesQs}`),
      ])
      if (signal?.aborted) return
      if (fJson.cities?.length) setCities(fJson.cities)
      setNeighborhoods(fJson.neighborhoods ?? [])
      setPropertyTypes(fJson.propertyTypes ?? [])
      setRows((oJson.opportunities ?? []) as OpportunityRow[])
      setPagination(
        oJson.pagination ?? {
          page,
          pageSize: DEFAULT_OPPORTUNITIES_PAGE_SIZE,
          total: oJson.opportunities?.length ?? 0,
          hasMore: false,
        },
      )
      setExpandedId(null)
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
      setError(uiText[lang].couldNotLoad)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [city, opportunitiesQs, lang, page])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  const handleCityChange = (nextCity: string) => {
    setCity(nextCity)
    setNeighborhood("all")
    setExcludedNeighborhoods([])
    setPage(1)
  }

  const handleFilterChange = () => setPage(1)

  const resultFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const resultTo = Math.min(pagination.page * pagination.pageSize, pagination.total)

  const resultsSummary = txt.opportunitiesResultsCount
    .replace("{from}", String(resultFrom))
    .replace("{to}", String(resultTo))
    .replace("{total}", String(pagination.total))

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.opportunitiesTitle}
        subtitle={txt.opportunitiesPurpose}
        active="opportunities"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        ) : null}

        {similarFilters ? (
          <Card className="mb-6 border-accent/30 bg-accent/5 p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {txt.opportunitiesSimilarBannerTitle}
                </p>
                <p className="mt-1 text-sm text-muted">{txt.opportunitiesSimilarBannerBody}</p>
              </div>
              <button
                type="button"
                onClick={clearSimilarFilters}
                className="shrink-0 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface dark:border-slate-700/80"
              >
                {txt.opportunitiesSimilarClear}
              </button>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72 lg:self-start">
            <Card className="border-border-subtle p-4 shadow-card">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
                {txt.opportunitiesPrimaryFilters}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-city">
                    {txt.city}
                  </label>
                  <select
                    id="opp-city"
                    className={`mt-1 w-full ${inputClassName}`}
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                  >
                    {cities.length === 0 ? (
                      <option value={city}>{city}</option>
                    ) : (
                      cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-type">
                    {txt.type}
                  </label>
                  <select
                    id="opp-type"
                    className={`mt-1 w-full ${inputClassName}`}
                    value={propertyType}
                    onChange={(e) => {
                      setPropertyType(e.target.value)
                      handleFilterChange()
                    }}
                  >
                    <option value="all">{txt.all}</option>
                    {propertyTypeOptions(propertyTypes, lang).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-neighborhood">
                    {txt.neighborhood}
                  </label>
                  <select
                    id="opp-neighborhood"
                    className={`mt-1 w-full ${inputClassName}`}
                    value={neighborhood}
                    onChange={(e) => {
                      setNeighborhood(e.target.value)
                      handleFilterChange()
                    }}
                  >
                    <option value="all">{txt.all}</option>
                    {neighborhoods.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-max-price">
                    {txt.opportunitiesMaxPrice}
                  </label>
                  <input
                    id="opp-max-price"
                    type="text"
                    inputMode="numeric"
                    className={`mt-1 w-full ${inputClassName}`}
                    value={maxPriceCop}
                    onChange={(e) => {
                      setMaxPriceCop(e.target.value)
                      handleFilterChange()
                    }}
                    placeholder={txt.opportunitiesMaxPricePlaceholder}
                  />
                  <p className="mt-1 text-xs text-muted">{txt.opportunitiesMaxPriceHint}</p>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted" htmlFor="opp-min-area">
                        {txt.opportunitiesMinArea}
                      </label>
                      <input
                        id="opp-min-area"
                        type="text"
                        inputMode="numeric"
                        className={`mt-1 w-full ${inputClassName}`}
                        value={minAreaM2}
                        onChange={(e) => {
                          setMinAreaM2(e.target.value)
                          handleFilterChange()
                        }}
                        placeholder={txt.opportunitiesAreaPlaceholderMin}
                        aria-describedby="opp-area-hint"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted" htmlFor="opp-max-area">
                        {txt.opportunitiesMaxArea}
                      </label>
                      <input
                        id="opp-max-area"
                        type="text"
                        inputMode="numeric"
                        className={`mt-1 w-full ${inputClassName}`}
                        value={maxAreaM2}
                        onChange={(e) => {
                          setMaxAreaM2(e.target.value)
                          handleFilterChange()
                        }}
                        placeholder={txt.opportunitiesAreaPlaceholderMax}
                        aria-describedby="opp-area-hint"
                      />
                    </div>
                  </div>
                  <p id="opp-area-hint" className="mt-1 text-xs text-muted">
                    {txt.opportunitiesAreaHint}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-min-discount">
                    {txt.opportunitiesMinDiscount}
                  </label>
                  <input
                    id="opp-min-discount"
                    type="text"
                    inputMode="decimal"
                    className={`mt-1 w-full ${inputClassName}`}
                    value={minDiscountPct}
                    onChange={(e) => {
                      setMinDiscountPct(e.target.value)
                      handleFilterChange()
                    }}
                    placeholder="12"
                    aria-describedby="opp-min-discount-hint"
                  />
                  <p id="opp-min-discount-hint" className="mt-1 text-xs text-muted">
                    {txt.opportunitiesMinDiscountHint}
                  </p>
                </div>

                <CollapsibleSection title={txt.toggleAdvancedFilters} className="pt-1">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={excludeUnknownNeighborhoods}
                        onChange={(e) => {
                          setExcludeUnknownNeighborhoods(e.target.checked)
                          handleFilterChange()
                        }}
                      />
                      <span>{txt.opportunitiesExcludeUnknown}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={hideLowConfidence}
                        onChange={(e) => {
                          setHideLowConfidence(e.target.checked)
                          handleFilterChange()
                        }}
                      />
                      <span>{txt.opportunitiesHideLowConfidence}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={excludeBarter}
                        onChange={(e) => {
                          setExcludeBarter(e.target.checked)
                          handleFilterChange()
                        }}
                      />
                      <span>{txt.opportunitiesExcludeBarter}</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={excludeProjects}
                        onChange={(e) => {
                          setExcludeProjects(e.target.checked)
                          handleFilterChange()
                        }}
                      />
                      <span>{txt.opportunitiesExcludeProjects}</span>
                    </label>

                    <div className="border-t border-slate-100 pt-3 dark:border-slate-700/80">
                      <label className="block text-xs font-medium text-muted" htmlFor="opp-exclude-input">
                        {txt.opportunitiesExcludeNeighborhoods}
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          id="opp-exclude-input"
                          type="text"
                          className={`min-w-0 flex-1 ${inputClassName}`}
                          value={excludeDraft}
                          onChange={(e) => setExcludeDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addExcludedFromDraft()
                            }
                          }}
                          placeholder={txt.opportunitiesExcludePlaceholder}
                          list="opp-exclude-datalist"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="shrink-0 px-3 py-2"
                          onClick={() => addExcludedFromDraft()}
                        >
                          {txt.opportunitiesExcludeAdd}
                        </Button>
                      </div>
                      <datalist id="opp-exclude-datalist">
                        {excludeSuggestions.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                      {excludedNeighborhoods.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {excludedNeighborhoods.map((ex) => (
                            <span
                              key={ex}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-foreground dark:border-slate-600 dark:bg-slate-800/70"
                            >
                              {ex}
                              <button
                                type="button"
                                className="rounded-full px-1 text-muted hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                aria-label={lang === "es" ? "Quitar" : "Remove"}
                                onClick={() => {
                                  setExcludedNeighborhoods((prev) => prev.filter((x) => x !== ex))
                                  handleFilterChange()
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs text-muted">{txt.opportunitiesExcludeHint}</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <Button
                  type="button"
                  className="w-full bg-accent py-2.5 text-accent-fg hover:bg-accent-hover"
                  onClick={() => void load()}
                >
                  {txt.refresh}
                </Button>
              </div>
            </Card>
          </aside>

          <div className="min-w-0 flex-1">
            <Card className="overflow-hidden border-border-subtle p-0 shadow-card">
              <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-surface/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {txt.opportunitiesTop10} · {city}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {loading ? "…" : resultsSummary}
                    {!loading && pagination.total > 0
                      ? ` · ${txt.opportunitiesPage.replace("{page}", String(pagination.page))}`
                      : ""}
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                  <label className="sr-only" htmlFor="opp-sortby">
                    {txt.opportunitiesSortedBy}
                  </label>
                  <select
                    id="opp-sortby"
                    className={`w-full sm:min-w-[210px] ${inputClassName}`}
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as SortBy)
                      setPage(1)
                    }}
                  >
                    <option value="dealScore">{txt.opportunitiesSortByDealScore}</option>
                    <option value="discount">{txt.opportunitiesSortByDiscount}</option>
                    <option value="price">{txt.opportunitiesSortByPrice}</option>
                    <option value="confidence">{txt.opportunitiesSortByConfidence}</option>
                  </select>
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
                  <thead className="bg-surface">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.listing}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.neighborhood}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.price}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.pricePerM2}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.opportunityDiscount}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.dealScore}</th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted">{txt.opportunitiesConfidence}</th>
                      <th scope="col" className="w-10 px-2 py-3" aria-label={txt.opportunitiesWhyDeal} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`skel-${i}`}>
                          <td className="px-4 py-3" colSpan={8}>
                            <Skeleton className="h-10 w-full rounded-lg" />
                          </td>
                        </tr>
                      ))
                    ) : rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={8}>
                          {txt.opportunitiesEmpty} {txt.adjustFiltersHint}
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const tags = signalTags(r, txt, lang)
                        const isExpanded = expandedId === r.id
                        return (
                          <Fragment key={r.id}>
                            <tr className="hover:bg-surface/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md bg-surface">
                                    {r.imageUrl ? (
                                      <ListingThumbnail
                                        src={r.imageUrl}
                                        alt={r.title}
                                        width={48}
                                        height={40}
                                        sizes="48px"
                                      />
                                    ) : null}
                                  </div>
                                  <a
                                    href={listingPath(lang, r.id)}
                                    className="font-medium text-accent hover:underline"
                                  >
                                    {r.title}
                                  </a>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {r.neighborhood ?? txt.unknown}
                                {r.zoneName ? (
                                  <span className="ml-1 text-xs text-muted">({r.zoneName})</span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {fmtCop(Number(r.priceCop), locale)}
                              </td>
                              <td className="px-4 py-3 tabular-nums">{fmtCop(r.pricePerM2, locale)}</td>
                              <td className="px-4 py-3 tabular-nums">
                                {r.discountVsRefPct == null ? "—" : `${r.discountVsRefPct.toFixed(1)}%`}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {r.dealScore?.toFixed(1) ?? "—"}
                              </td>
                              <td className="px-4 py-3">{confidenceLabel(r.confidence, txt)}</td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                  aria-expanded={isExpanded}
                                  aria-label={
                                    isExpanded
                                      ? txt.opportunitiesWhyDealCollapse
                                      : txt.opportunitiesWhyDealExpand
                                  }
                                  title={txt.opportunitiesWhyDeal}
                                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                >
                                  <svg
                                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="bg-surface/30">
                                <td className="px-4 py-3" colSpan={8}>
                                  <div className="space-y-4">
                                    {tags.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/80"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                    {r.priceTimeline && r.priceTimeline.length > 1 ? (
                                      <div className="rounded-xl border border-border-subtle bg-elevated px-3 py-2 dark:border-slate-700/80">
                                        <p className="mb-1 text-xs font-medium text-muted">
                                          {txt.priceTimelineTitle}
                                        </p>
                                        <PriceTimelineChart
                                          points={r.priceTimeline.map((p) => ({
                                            recordedAt: p.recordedAt,
                                            priceCop: Number(p.priceCop),
                                          }))}
                                          locale={locale}
                                          noDataLabel={txt.analyzePriceTimelineEmpty}
                                          tooltipLabel={txt.analyzePriceTimelineTooltip}
                                          compact
                                        />
                                      </div>
                                    ) : null}
                                    {r.whyDeal ? (
                                      <WhyDealPanel
                                        whyDeal={r.whyDeal}
                                        title={txt.opportunitiesWhyDeal}
                                        lang={lang}
                                        locale={locale}
                                      />
                                    ) : null}
                                    <NearbyAmenitiesSection
                                      latitude={r.latitude}
                                      longitude={r.longitude}
                                      lang={lang}
                                      locale={locale}
                                      enabled={isExpanded}
                                      compact
                                    />
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={`mob-skel-${i}`} className="h-36 w-full" />
                  ))
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted">
                    {txt.opportunitiesEmpty} {txt.adjustFiltersHint}
                  </p>
                ) : (
                  rows.map((r) => {
                    const tags = signalTags(r, txt, lang)
                    const isExpanded = expandedId === r.id
                    return (
                      <OpportunityMobileCard
                        key={r.id}
                        title={r.title}
                        detailHref={listingPath(lang, r.id)}
                        location={`${r.city} · ${r.neighborhood ?? txt.unknown}`}
                        price={fmtCop(Number(r.priceCop), locale)}
                        pricePerM2={fmtCop(r.pricePerM2, locale)}
                        pricePerM2Num={r.pricePerM2}
                        refAvg={r.refAvgUsed}
                        locale={locale}
                        discount={
                          r.discountVsRefPct == null ? "—" : `${r.discountVsRefPct.toFixed(1)}%`
                        }
                        dealScore={r.dealScore?.toFixed(1) ?? "—"}
                        confidence={confidenceLabel(r.confidence, txt)}
                        sampleSize={r.compSampleSize}
                        imageUrl={r.imageUrl}
                        priceLabel={txt.price}
                        pricePerM2Label={txt.pricePerM2}
                        discountLabel={txt.opportunityDiscount}
                        dealScoreLabel={txt.dealScore}
                        tags={tags}
                        expanded={isExpanded}
                        expandLabel={txt.opportunitiesWhyDealExpand}
                        collapseLabel={txt.opportunitiesWhyDealCollapse}
                        onToggle={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        {r.whyDeal ? (
                          <WhyDealPanel
                            whyDeal={r.whyDeal}
                            title={txt.opportunitiesWhyDeal}
                            lang={lang}
                            locale={locale}
                          />
                        ) : null}
                        <NearbyAmenitiesSection
                          latitude={r.latitude}
                          longitude={r.longitude}
                          lang={lang}
                          locale={locale}
                          enabled={isExpanded}
                          compact
                        />
                      </OpportunityMobileCard>
                    )
                  })
                )}
              </div>

              {!loading && pagination.total > pagination.pageSize ? (
                <div className="border-t border-border-subtle bg-slate-50/95 px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900/40">
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-accent hover:bg-accent/5 hover:text-accent disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:hover:border-slate-200 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-accent dark:hover:bg-accent/10 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:min-w-[9.5rem]"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label={txt.opportunitiesPrevPage}
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {txt.opportunitiesPrevPage}
                    </button>

                    <p className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-center text-sm font-semibold text-muted shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {txt.opportunitiesPage.replace("{page}", String(pagination.page))}
                    </p>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-accent hover:bg-accent/5 hover:text-accent disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:hover:border-slate-200 disabled:hover:bg-slate-100 disabled:hover:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-accent dark:hover:bg-accent/10 dark:disabled:border-slate-700 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500 sm:min-w-[9.5rem]"
                      disabled={!pagination.hasMore}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label={txt.opportunitiesNextPage}
                    >
                      {txt.opportunitiesNextPage}
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        </div>

        <ToolNextSteps title={txt.nextStepsTitle} steps={nextSteps} />

        <EmailSignupForm
          lang={lang}
          source="opportunities"
          title={txt.subscribeTitle}
          hint={txt.subscribeHint}
          defaultCity={city}
          defaultLists={["deals_city", "price_drops_city"]}
          visibleLists={["deals_city", "deals_neighborhood", "price_drops_city", "market_monthly_city"]}
          collapsedByDefault
          className="mt-8"
        />
      </main>
      <PageFooter />
    </div>
  )
}
