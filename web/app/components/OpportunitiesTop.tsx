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
import SearchableSelect from "@/app/components/ui/SearchableSelect"
import Skeleton from "@/app/components/ui/Skeleton"
import SiteHeader from "@/app/components/SiteHeader"
import WhyDealPanel from "@/app/components/WhyDealPanel"
import { fetchJsonCached } from "@/lib/clientFetchCache"
import type { FiltersData } from "@/lib/getFiltersData"
import { formatDomDays } from "@/lib/formatDom"
import type { WhyDeal } from "@/lib/dealEngine"
import type { DealReview } from "@/lib/dealReview"
import { dealReviewLabels } from "@/lib/dealLabels"
import {
  DEFAULT_OPPORTUNITIES_CITY,
  DEFAULT_OPPORTUNITIES_PAGE_SIZE,
  MAX_OPPORTUNITIES_RESULTS,
} from "@/lib/getTopOpportunities"
import { mapCenterForCity } from "@/lib/cityCenters"
import { cityDisplayName } from "@/lib/cityNames"
import { listingPath } from "@/lib/locale"
import { buildListingContextLinks } from "@/lib/listingContextLinks"
import { uiText } from "@/lib/i18n"
import { propertyTypeOptions } from "@/lib/propertyTypes"
import { useUiLang } from "@/lib/useUiLang"

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-lg bg-surface" />,
})

const OpportunitiesMap = dynamic(() => import("@/app/components/OpportunitiesMap"), {
  ssr: false,
  loading: () => <div className="h-[28rem] animate-pulse bg-surface" />,
})

type ResultsView = "list" | "map"

type OpportunityRow = {
  id: string
  title: string
  city: string
  neighborhood: string | null
  zoneName?: string | null
  priceCop: string
  areaM2: number
  estrato?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  review?: DealReview
  promoted?: boolean
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

function listingFacts(
  row: OpportunityRow,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  const parts: string[] = []
  if (Number.isFinite(row.areaM2) && row.areaM2 > 0) parts.push(`${Math.round(row.areaM2)} m²`)
  if (row.bedrooms != null && row.bedrooms > 0) {
    parts.push(txt.opportunitiesBedsShort.replace("{n}", String(row.bedrooms)))
  }
  if (row.estrato != null) {
    parts.push(txt.opportunitiesEstratoShort.replace("{n}", String(row.estrato)))
  }
  return parts.join(" · ")
}

/** Portals often put the city in the barrio field; the zone is more useful then. */
function locationLines(row: OpportunityRow): { main: string | null; sub: string | null } {
  const barrio = row.neighborhood?.trim() || null
  const zone = row.zoneName?.trim() || null
  const main =
    barrio && barrio.toLowerCase() !== row.city.trim().toLowerCase() ? barrio : zone
  return { main, sub: zone && zone !== main ? zone : null }
}

function discountText(
  pct: number | null,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (pct == null) return "—"
  return txt.opportunitiesDiscountBelow.replace("{pct}", pct.toFixed(1))
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

function NeighborhoodChip({
  label,
  clearLabel,
  onClear,
}: {
  label: string
  clearLabel: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-elevated py-1 pl-2.5 pr-1 text-xs font-medium text-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sm leading-none text-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-label={clearLabel}
        onClick={onClear}
      >
        ×
      </button>
    </span>
  )
}

function initialOppParam(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const v = new URLSearchParams(window.location.search).get(name)?.trim()
  return v && v.length > 0 && v !== "all" ? v : fallback
}

function initialSelectedEstratos(): number[] {
  if (typeof window === "undefined") return []
  const p = new URLSearchParams(window.location.search)
  const set = new Set<number>()
  for (const raw of p.getAll("estrato")) {
    for (const part of raw.split(",")) {
      const n = Number.parseInt(part.trim(), 10)
      if (Number.isFinite(n) && n >= 1 && n <= 6) set.add(n)
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

function initialSelectedPropertyTypes(): string[] {
  if (typeof window === "undefined") return []
  const p = new URLSearchParams(window.location.search)
  const set = new Set<string>()
  for (const raw of p.getAll("propertyType")) {
    for (const part of raw.split(",")) {
      const t = part.trim()
      if (t && t !== "all") set.add(t)
    }
  }
  return Array.from(set)
}

function initialSelectedNeighborhoods(): string[] {
  if (typeof window === "undefined") return []
  const p = new URLSearchParams(window.location.search)
  const set = new Set<string>()
  for (const raw of p.getAll("neighborhood")) {
    const t = raw.trim()
    if (t && t !== "all") set.add(t)
  }
  return Array.from(set)
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
  const [neighborhoodSearch, setNeighborhoodSearch] = useState<string[]>(
    initialFilters?.neighborhoodSearch ?? initialFilters?.neighborhoods ?? [],
  )
  const [neighborhoodQuery, setNeighborhoodQuery] = useState("")
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    initialFilters?.propertyTypes ?? [],
  )
  const [estratos, setEstratos] = useState<number[]>(initialFilters?.estratos ?? [])
  const [city, setCity] = useState(() =>
    initialOppParam("city", DEFAULT_OPPORTUNITIES_CITY),
  )
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(() =>
    initialSelectedNeighborhoods(),
  )
  const [mounted, setMounted] = useState(false)
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(() =>
    initialSelectedPropertyTypes(),
  )
  const [selectedEstratos, setSelectedEstratos] = useState<number[]>(() =>
    initialSelectedEstratos(),
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
  const [hideReview, setHideReview] = useState(() => initialOppParam("hideReview", "0") === "1")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("dealScore")
  const [resultsView, setResultsView] = useState<ResultsView>("list")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<OpportunityRow[]>([])
  const [mapRows, setMapRows] = useState<OpportunityRow[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: DEFAULT_OPPORTUNITIES_PAGE_SIZE,
    total: 0,
    hasMore: false,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapLoading, setMapLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const neighborhoodOptions = useMemo(() => {
    const source = neighborhoodQuery.trim() ? neighborhoodSearch : neighborhoods
    return Array.from(new Set(source))
      .filter((n) => !selectedNeighborhoods.includes(n))
      .map((n) => ({ value: n, label: n }))
  }, [neighborhoodQuery, neighborhoodSearch, neighborhoods, selectedNeighborhoods])

  const propertyTypeChoices = useMemo(() => {
    if (propertyTypes.length === 0) return []
    const names = new Set(propertyTypes)
    for (const t of selectedPropertyTypes) names.add(t)
    return propertyTypeOptions(Array.from(names), lang)
  }, [lang, propertyTypes, selectedPropertyTypes])

  const excludeSuggestions = useMemo(() => {
    const q = excludeDraft.trim().toLowerCase()
    if (!q) return []
    return neighborhoods
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 40)
  }, [neighborhoods, excludeDraft])

  const opportunitiesFilterParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set("city", city)
    for (const t of selectedPropertyTypes) p.append("propertyType", t)
    for (const n of selectedNeighborhoods) p.append("neighborhood", n)
    if (selectedEstratos.length > 0) {
      for (const e of selectedEstratos) p.append("estrato", String(e))
    } else if (similarFilters?.estrato) {
      p.append("estrato", similarFilters.estrato)
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
    p.set("hideReview", hideReview ? "1" : "0")
    p.set("sortBy", sortBy)
    return p
  }, [
    city,
    selectedEstratos,
    excludeBarter,
    excludeProjects,
    excludeUnknownNeighborhoods,
    excludedNeighborhoods,
    hideLowConfidence,
    hideReview,
    maxAreaM2,
    maxPriceCop,
    minAreaM2,
    minDiscountPct,
    selectedNeighborhoods,
    selectedPropertyTypes,
    similarFilters,
    sortBy,
  ])

  const opportunitiesQs = useMemo(() => {
    const p = new URLSearchParams(opportunitiesFilterParams)
    p.set("page", String(page))
    p.set("pageSize", String(DEFAULT_OPPORTUNITIES_PAGE_SIZE))
    return `?${p.toString()}`
  }, [opportunitiesFilterParams, page])

  const opportunitiesMapQs = useMemo(() => {
    const p = new URLSearchParams(opportunitiesFilterParams)
    p.set("page", "1")
    p.set("pageSize", String(MAX_OPPORTUNITIES_RESULTS))
    return `?${p.toString()}`
  }, [opportunitiesFilterParams])

  const nextSteps = useMemo(() => {
    const links = buildListingContextLinks({
      lang,
      city,
      neighborhood: selectedNeighborhoods.length === 1 ? selectedNeighborhoods[0] : null,
      propertyType: selectedPropertyTypes.length === 1 ? selectedPropertyTypes[0] : null,
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
  }, [city, lang, selectedNeighborhoods, selectedPropertyTypes, txt])

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

  useEffect(() => {
    setMounted(true)
  }, [])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const filtersUrl = `/api/filters?city=${encodeURIComponent(city)}`
      const filtersPromise = fetchJsonCached<{
        cities?: string[]
        neighborhoods?: string[]
        neighborhoodSearch?: string[]
        propertyTypes?: string[]
        estratos?: number[]
      }>(filtersUrl)
      const oJson = await fetchJsonCached<{
        opportunities?: OpportunityRow[]
        pagination?: PaginationMeta
      }>(`/api/opportunities${opportunitiesQs}`)
      if (signal?.aborted) return
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
      setLoading(false)
      try {
        const fJson = await filtersPromise
        if (signal?.aborted) return
        if (fJson.cities?.length) setCities(fJson.cities)
        setNeighborhoods(fJson.neighborhoods ?? [])
        setNeighborhoodSearch(fJson.neighborhoodSearch ?? fJson.neighborhoods ?? [])
        setPropertyTypes(fJson.propertyTypes ?? [])
        setEstratos(fJson.estratos ?? [])
      } catch (filterErr) {
        if (signal?.aborted || (filterErr instanceof DOMException && filterErr.name === "AbortError")) return
        console.error(filterErr)
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
      setError(uiText[lang].couldNotLoad)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [city, opportunitiesQs, lang, page])

  const loadMap = useCallback(async (signal?: AbortSignal) => {
    setMapLoading(true)
    try {
      const oJson = await fetchJsonCached<{
        opportunities?: OpportunityRow[]
      }>(`/api/opportunities${opportunitiesMapQs}`)
      if (signal?.aborted) return
      setMapRows((oJson.opportunities ?? []) as OpportunityRow[])
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
      setError(uiText[lang].couldNotLoad)
    } finally {
      if (!signal?.aborted) setMapLoading(false)
    }
  }, [opportunitiesMapQs, lang])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  useEffect(() => {
    if (resultsView !== "map") return
    const ac = new AbortController()
    void loadMap(ac.signal)
    return () => ac.abort()
  }, [loadMap, resultsView])

  const handleCityChange = (nextCity: string) => {
    setCity(nextCity)
    setSelectedNeighborhoods([])
    setNeighborhoods([])
    setNeighborhoodSearch([])
    setNeighborhoodQuery("")
    setPropertyTypes([])
    setEstratos([])
    setSelectedEstratos([])
    setExcludedNeighborhoods([])
    setPage(1)
  }

  const handleToggleEstrato = (value: number) => {
    setSelectedEstratos((prev) => {
      if (prev.includes(value)) return prev.filter((e) => e !== value)
      return [...prev, value].sort((a, b) => a - b)
    })
    handleFilterChange()
  }

  const handleTogglePropertyType = (value: string) => {
    setSelectedPropertyTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    )
    handleFilterChange()
  }

  const handleFilterChange = () => setPage(1)

  const handleAddNeighborhood = (value: string) => {
    const t = value.trim()
    if (!t) {
      setSelectedNeighborhoods([])
    } else {
      setSelectedNeighborhoods((prev) =>
        prev.some((n) => n.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t],
      )
    }
    handleFilterChange()
  }

  const handleRemoveNeighborhood = (value: string) => {
    setSelectedNeighborhoods((prev) => prev.filter((n) => n !== value))
    handleFilterChange()
  }

  const neighborhoodChip =
    mounted && selectedNeighborhoods.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {selectedNeighborhoods.map((n) => (
          <NeighborhoodChip
            key={n}
            label={`${txt.neighborhood}: ${n}`}
            clearLabel={txt.opportunitiesClearNeighborhood}
            onClear={() => handleRemoveNeighborhood(n)}
          />
        ))}
      </div>
    ) : null

  const resultFrom =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const resultTo = Math.min(pagination.page * pagination.pageSize, pagination.total)
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const pageLabel = txt.opportunitiesPage
    .replace("{page}", String(pagination.page))
    .replace("{pages}", String(totalPages))

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
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-elevated px-4 py-3 text-sm font-semibold text-foreground shadow-card lg:hidden"
            aria-expanded={mobileFiltersOpen}
            aria-controls="opp-filters"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <span>{mobileFiltersOpen ? txt.opportunitiesHideFilters : txt.opportunitiesShowFilters}</span>
            <span className="text-xs font-normal text-muted">{city}</span>
          </button>
          <aside
            id="opp-filters"
            className={`w-full shrink-0 lg:sticky lg:top-24 lg:block lg:w-72 lg:self-start ${
              mobileFiltersOpen ? "block" : "hidden"
            }`}
          >
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
                          {cityDisplayName(c)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-muted">{txt.type}</legend>
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label={txt.type}
                  >
                    {propertyTypeChoices.length === 0 ? (
                      <p className="text-xs text-muted">{txt.all}</p>
                    ) : (
                      propertyTypeChoices.map((t) => {
                        const checked = selectedPropertyTypes.includes(t.value)
                        return (
                          <label
                            key={t.value}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                              checked
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border-subtle bg-elevated text-muted hover:text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[var(--accent)]"
                              checked={checked}
                              onChange={() => handleTogglePropertyType(t.value)}
                            />
                            {t.label}
                          </label>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{txt.opportunitiesMultiSelectHint}</p>
                </fieldset>

                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="opp-neighborhood">
                    {txt.neighborhood}
                  </label>
                  <SearchableSelect
                    id="opp-neighborhood"
                    className="mt-1"
                    allowEmpty
                    allowCustom
                    emptyLabel={txt.all}
                    value=""
                    options={neighborhoodOptions}
                    filterMode="tokens"
                    placeholder={txt.searchableSelectPlaceholder}
                    noResultsLabel={txt.searchableSelectNoMatch}
                    customOptionLabel={txt.opportunitiesUseTypedNeighborhood}
                    openListLabel={txt.searchableSelectOpenList}
                    closeListLabel={txt.searchableSelectCloseList}
                    aria-label={txt.neighborhood}
                    onQueryChange={setNeighborhoodQuery}
                    onChange={handleAddNeighborhood}
                  />
                  {neighborhoodChip ? <div className="mt-2">{neighborhoodChip}</div> : null}
                  <p className="mt-1 text-xs text-muted">{txt.opportunitiesMultiSelectHint}</p>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-muted">{txt.estrato}</legend>
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label={txt.estrato}
                  >
                    {estratos.length === 0 ? (
                      <p className="text-xs text-muted">{txt.all}</p>
                    ) : (
                      estratos.map((e) => {
                        const checked = selectedEstratos.includes(e)
                        return (
                          <label
                            key={e}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                              checked
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border-subtle bg-elevated text-muted hover:text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[var(--accent)]"
                              checked={checked}
                              onChange={() => handleToggleEstrato(e)}
                            />
                            {e}
                          </label>
                        )
                      })
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{txt.opportunitiesMultiSelectHint}</p>
                </fieldset>

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
                    placeholder={txt.opportunitiesMinDiscountPlaceholder}
                    aria-describedby="opp-min-discount-hint"
                  />
                  <p id="opp-min-discount-hint" className="mt-1 text-xs text-muted">
                    {txt.opportunitiesMinDiscountHint}
                  </p>
                </div>

                <div>
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={hideReview}
                      onChange={(e) => {
                        setHideReview(e.target.checked)
                        handleFilterChange()
                      }}
                      aria-describedby="opp-hide-review-hint"
                    />
                    <span>{txt.opportunitiesHideReview}</span>
                  </label>
                  <p id="opp-hide-review-hint" className="mt-1 text-xs text-muted">
                    {txt.opportunitiesHideReviewHint}
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
              <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {txt.opportunitiesTitle} · {city}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {loading ? "…" : resultsSummary}
                    {!loading && pagination.total > 0 ? ` · ${pageLabel}` : ""}
                  </p>
                  {neighborhoodChip ? <div className="mt-2">{neighborhoodChip}</div> : null}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div
                    className="inline-flex rounded-lg border border-border-subtle bg-elevated p-0.5"
                    role="group"
                    aria-label={txt.opportunitiesViewModeLabel}
                  >
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        resultsView === "list"
                          ? "bg-accent text-accent-fg"
                          : "text-muted hover:text-foreground"
                      }`}
                      aria-pressed={resultsView === "list"}
                      onClick={() => setResultsView("list")}
                    >
                      {txt.opportunitiesViewList}
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        resultsView === "map"
                          ? "bg-accent text-accent-fg"
                          : "text-muted hover:text-foreground"
                      }`}
                      aria-pressed={resultsView === "map"}
                      onClick={() => setResultsView("map")}
                    >
                      {txt.opportunitiesViewMap}
                    </button>
                  </div>
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

              {resultsView === "map" ? (
                <div>
                  <OpportunitiesMap
                    items={mapRows}
                    lang={lang}
                    locale={locale}
                    mapKey={city}
                    cityCenter={mapCenterForCity(city)}
                    loading={mapLoading}
                    emptyLabel={`${txt.opportunitiesEmpty} ${txt.adjustFiltersHint}`}
                    noCoordsLabel={txt.opportunitiesMapNoCoords}
                    discountLabel={txt.opportunityDiscount}
                    dealScoreLabel={txt.dealScore}
                    openListingLabel={txt.opportunitiesMapOpenListing}
                  />
                  {!mapLoading && mapRows.length > 0 ? (
                    <p className="border-t border-border-subtle px-4 py-2 text-xs text-muted">
                      {txt.opportunitiesMapShowingAll
                        .replace("{count}", String(mapRows.length))
                        .replace("{max}", String(MAX_OPPORTUNITIES_RESULTS))}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={`overflow-x-auto ${resultsView === "list" ? "hidden md:block" : "hidden"}`}>
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
                                  <div className="min-w-0 max-w-xs">
                                    <a
                                      href={listingPath(lang, r.id)}
                                      className="line-clamp-2 font-medium text-accent hover:underline"
                                      title={r.title}
                                    >
                                      {r.title}
                                    </a>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                                      <span>{listingFacts(r, txt)}</span>
                                      {r.review?.needsReview ? (
                                        <span
                                          className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300"
                                          title={dealReviewLabels(r.review, lang).join(" ")}
                                        >
                                          {txt.reviewBadge}
                                        </span>
                                      ) : null}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="block">{locationLines(r).main ?? txt.unknown}</span>
                                {locationLines(r).sub ? (
                                  <span className="block text-xs text-muted">{locationLines(r).sub}</span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {fmtCop(Number(r.priceCop), locale)}
                              </td>
                              <td className="px-4 py-3 tabular-nums">{fmtCop(r.pricePerM2, locale)}</td>
                              <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                                {discountText(r.discountVsRefPct, txt)}
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

              <div className={`space-y-3 p-4 md:hidden ${resultsView === "map" ? "hidden" : ""}`}>
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
                        location={`${cityDisplayName(r.city)} · ${locationLines(r).main ?? txt.unknown}`}
                        price={fmtCop(Number(r.priceCop), locale)}
                        pricePerM2={fmtCop(r.pricePerM2, locale)}
                        pricePerM2Num={r.pricePerM2}
                        refAvg={r.refAvgUsed}
                        locale={locale}
                        discount={discountText(r.discountVsRefPct, txt)}
                        facts={listingFacts(r, txt)}
                        reviewLabel={r.review?.needsReview ? txt.reviewBadge : undefined}
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
                      {pageLabel}
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
