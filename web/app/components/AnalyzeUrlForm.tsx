"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"

import PageFooter from "@/app/components/PageFooter"
import ShareReportActions from "@/app/components/ShareReportActions"
import DomBadge from "@/app/components/DomBadge"
import VerdictBanner from "@/app/components/VerdictBanner"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import SiteHeader from "@/app/components/SiteHeader"
import WhyDealPanel from "@/app/components/WhyDealPanel"
import type { WhyDeal } from "@/lib/dealEngine"
import { dealWarningLabel } from "@/lib/dealLabels"
import { formatDomDays } from "@/lib/formatDom"
import { uiText } from "@/lib/i18n"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import { useUiLang } from "@/lib/useUiLang"
import type { SharedAnalyzePayload } from "@/lib/shareReport"

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full" />,
})

type PriceTimelinePoint = { recordedAt: string; priceCop: string }

type AnalyzeResponse = {
  listing: {
    title: string
    url: string
    city: string
    neighborhood: string | null
    propertyType: string | null
    operationType: string | null
    priceCop: string
    areaM2: number
    areaBuiltM2: number | null
    areaPrivateM2: number | null
    areaTerrainM2: number | null
    areaTerraceM2: number | null
    estrato: number | null
    bedrooms: number | null
    bathrooms: number | null
    garage: number | null
    pricePerM2: number | null
    constructionState: string | null
    facilities: unknown
  }
  analysis: {
    dealScore: number | null
    verdict: "good_deal" | "fair" | "overpriced"
    confidence: "high" | "medium" | "low"
    warnings: string[]
    discountVsRefPct: number | null
    referencePpm2: number | null
    referencePpm2Nearby?: number | null
    referencePpm2Neighborhood?: number | null
    sampleSize: number
    compMethod?: string
    metricType?: string
    whyDeal?: WhyDeal | null
    domDays?: number | null
    priceDropPct?: number | null
  }
  priceTimeline?: PriceTimelinePoint[]
  comps: Array<{
    id: string
    title: string
    city: string
    neighborhood: string | null
    priceCop: string
    areaM2: number
    pricePerM2: number | null
    distanceMeters: number | null
    url: string
  }>
}

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

function formatFacilities(raw: unknown): string | null {
  if (!raw) return null
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map(String).join(", ")
  }
  if (typeof raw === "object" && raw !== null) {
    const entries = Object.entries(raw as Record<string, unknown>).filter(
      ([, v]) => v === true || (typeof v === "string" && v.trim()),
    )
    if (entries.length === 0) return null
    return entries.map(([k, v]) => (v === true ? k : `${k}: ${v}`)).join(", ")
  }
  return null
}

function initialUrlParam(): string {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("url")?.trim() ?? ""
}

export default function AnalyzeUrlForm() {
  const { lang, toggleLang } = useUiLang("es")
  const txt = uiText[lang]
  const locale = lang === "es" ? "es-CO" : "en-US"

  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyzeResponse | null>(null)

  useEffect(() => {
    const param = initialUrlParam()
    if (param) setUrl(param)
  }, [])

  const opportunitiesHref = useMemo(() => {
    if (!data) return "/opportunities"
    const p = new URLSearchParams()
    p.set("city", data.listing.city)
    if (data.listing.neighborhood) p.set("neighborhood", data.listing.neighborhood)
    if (data.listing.propertyType) p.set("propertyType", data.listing.propertyType)
    return `/opportunities?${p.toString()}`
  }, [data])

  const priceTimelinePoints = useMemo(
    () =>
      (data?.priceTimeline ?? []).map((p) => ({
        recordedAt: p.recordedAt,
        priceCop: Number(p.priceCop),
      })),
    [data?.priceTimeline],
  )

  const sharePayload = useMemo((): SharedAnalyzePayload | null => {
    if (!data) return null
    return {
      listing: data.listing,
      analysis: {
        dealScore: data.analysis.dealScore,
        verdict: data.analysis.verdict,
        confidence: data.analysis.confidence,
        warnings: data.analysis.warnings,
        discountVsRefPct: data.analysis.discountVsRefPct,
        referencePpm2: data.analysis.referencePpm2,
        referencePpm2Nearby: data.analysis.referencePpm2Nearby,
        referencePpm2Neighborhood: data.analysis.referencePpm2Neighborhood,
        sampleSize: data.analysis.sampleSize,
        compMethod: data.analysis.compMethod ?? data.analysis.whyDeal?.compMethod,
        metricType: data.analysis.metricType ?? data.analysis.whyDeal?.metricType,
        whyDeal: data.analysis.whyDeal,
        domDays: data.analysis.domDays ?? null,
        priceDropPct: data.analysis.priceDropPct ?? null,
      },
      priceTimeline: data.priceTimeline,
      comps: data.comps,
    }
  }, [data])

  const domLabel = data ? formatDomDays(data.analysis.domDays, lang) : null

  const enrichmentRows = useMemo(() => {
    if (!data) return []
    const l = data.listing
    const rows: { label: string; value: string }[] = []
    if (l.areaTerraceM2 != null && l.areaTerraceM2 > 0) {
      rows.push({
        label: txt.analyzeEnrichmentTerrace,
        value: `${l.areaTerraceM2.toFixed(1)} m²`,
      })
    }
    if (l.areaPrivateM2 != null && l.areaPrivateM2 > 0) {
      rows.push({
        label: txt.opportunitiesMetricPrivate,
        value: `${l.areaPrivateM2.toFixed(1)} m²`,
      })
    }
    if (l.garage != null && l.garage > 0) {
      rows.push({
        label: txt.analyzeEnrichmentGarage,
        value: String(l.garage),
      })
    }
    if (l.constructionState?.trim()) {
      rows.push({
        label: txt.analyzeEnrichmentConstruction,
        value: l.constructionState,
      })
    }
    const facilities = formatFacilities(l.facilities)
    if (facilities) {
      rows.push({ label: txt.analyzeEnrichmentFacilities, value: facilities })
    }
    return rows
  }, [data, txt])

  const hasCompTypeWarning = useMemo(() => {
    if (!data) return false
    return data.analysis.warnings.some(
      (w) =>
        w.includes("mixed_comp_property_types") ||
        w.includes("type_location_mismatch"),
    )
  }, [data])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setData(null)
    if (!url.trim()) {
      setError(txt.analyzeUrlRequired)
      return
    }
    try {
      const parsed = new URL(url.trim())
      if (!parsed.hostname.includes("fincaraiz.com.co")) {
        setError(txt.analyzeUrlInvalid)
        return
      }
    } catch {
      setError(txt.analyzeUrlInvalid)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const j = (await res.json()) as AnalyzeResponse & { error?: string }
      if (!res.ok) {
        const err = j.error ?? "server_error"
        if (err === "url_required") setError(txt.analyzeUrlRequired)
        else if (err === "url_not_allowed" || err === "url_path_invalid") {
          setError(txt.analyzeUrlInvalid)
        } else if (err === "fetch_failed") setError(txt.analyzeFetchFailed)
        else if (err === "price_missing" || err === "area_missing") {
          setError(txt.analyzeParseIncomplete)
        } else setError(txt.analyzeServerError)
        return
      }
      setData(j)
    } catch {
      setError(txt.analyzeServerError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.analyzeUrlTitle}
        subtitle={txt.analyzeUrlPurpose}
        active="analyzeUrl"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            {error}
          </div>
        ) : null}

        <Card className="mb-6 border-slate-200/90 shadow-card">
          <form id="analyze-url-form" onSubmit={(e) => void submit(e)}>
            <label className="block text-xs font-medium text-muted" htmlFor="analyze-url-input">
              {txt.analyzeUrlInputLabel}
            </label>
            <input
              id="analyze-url-input"
              type="url"
              required
              className={inputClassName}
              placeholder="https://www.fincaraiz.com.co/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted">{txt.analyzeUrlExample}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={loading} className="hidden disabled:opacity-60 sm:inline-flex">
                {loading ? txt.analyzeUrlLoading : txt.analyzeUrlSubmit}
              </Button>
              <p className="text-xs text-muted">{txt.analyzeUrlHint}</p>
            </div>
          </form>
        </Card>

        {loading ? (
          <Card className="mb-6 space-y-4 border-slate-200/90 p-6 shadow-card">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <p className="text-sm text-muted">{txt.analyzeLoadingHint}</p>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ) : null}

        {data ? (
          <div className="space-y-6">
            <VerdictBanner
              verdict={data.analysis.verdict}
              confidence={data.analysis.confidence}
              dealScore={data.analysis.dealScore}
              discountPct={data.analysis.discountVsRefPct}
              sampleSize={data.analysis.sampleSize}
              lang={lang}
              locale={locale}
              listingPpm2={data.listing.pricePerM2}
              referencePpm2={data.analysis.referencePpm2}
              priceCop={data.listing.priceCop}
              city={data.listing.city}
              neighborhood={data.listing.neighborhood}
              estrato={data.listing.estrato}
              propertyType={data.listing.propertyType}
              compMethod={data.analysis.compMethod ?? data.analysis.whyDeal?.compMethod}
              metricType={data.analysis.metricType ?? data.analysis.whyDeal?.metricType}
              priceDropPct={data.analysis.priceDropPct}
              domDays={data.analysis.domDays}
            />

            {sharePayload ? (
              <Card className="border-slate-200/90 shadow-card">
                <h2 className="text-sm font-semibold text-foreground">{txt.shareReportTitle}</h2>
                <p className="mt-1 text-xs text-muted">{txt.shareReportHint}</p>
                <div className="mt-3">
                  <ShareReportActions payload={sharePayload} lang={lang} />
                </div>
              </Card>
            ) : null}

            {hasCompTypeWarning ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                {txt.analyzeCompTypeMismatch}
              </div>
            ) : null}

            {data.analysis.whyDeal ? (
              <WhyDealPanel
                whyDeal={data.analysis.whyDeal}
                title={txt.analyzeWhyDeal}
                lang={lang}
                locale={locale}
              />
            ) : null}

            <Card className="border-slate-200/90 shadow-card">
              <h2 className="text-lg font-semibold text-foreground">{txt.analyzeDealAssessment}</h2>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">{txt.analyzeReferencePpm2Nearby}:</span>{" "}
                  {fmtCop(data.analysis.referencePpm2Nearby ?? data.analysis.referencePpm2, locale)}
                </p>
                <p>
                  <span className="text-muted">{txt.analyzeReferencePpm2Neighborhood}:</span>{" "}
                  {fmtCop(data.analysis.referencePpm2Neighborhood, locale)}
                </p>
                <p>
                  <span className="text-muted">{txt.sample}:</span> {data.analysis.sampleSize}
                </p>
              </div>
              <Button href={opportunitiesHref} variant="secondary" className="mt-4">
                {txt.analyzeFindSimilar}
              </Button>
              {data.analysis.warnings.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
                  {data.analysis.warnings.map((w) => (
                    <li key={w}>{dealWarningLabel(w, lang)}</li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <Card className="border-slate-200/90 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{txt.analyzeListingSnapshot}</h2>
                {domLabel ? (
                  <DomBadge days={data.analysis.domDays} lang={lang} label={domLabel} />
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted">{txt.listing}:</span> {data.listing.title}
                </p>
                <p>
                  <span className="text-muted">{txt.city}:</span> {data.listing.city}
                </p>
                <p>
                  <span className="text-muted">{txt.neighborhood}:</span>{" "}
                  {data.listing.neighborhood ?? txt.unknown}
                </p>
                <p>
                  <span className="text-muted">{txt.type}:</span>{" "}
                  {propertyTypeLabel(data.listing.propertyType, lang)}
                </p>
                <p>
                  <span className="text-muted">{txt.price}:</span>{" "}
                  {fmtCop(Number(data.listing.priceCop), locale)}
                </p>
                <p>
                  <span className="text-muted">{txt.pricePerM2}:</span>{" "}
                  {fmtCop(data.listing.pricePerM2, locale)}
                </p>
                <p>
                  <span className="text-muted">{txt.estimateArea}:</span>{" "}
                  {data.listing.areaM2.toFixed(1)} m²
                </p>
                <p>
                  <span className="text-muted">{txt.opportunitiesMetricBuilt}:</span>{" "}
                  {data.listing.areaBuiltM2 != null ? `${data.listing.areaBuiltM2.toFixed(1)} m²` : "—"}
                </p>
                <p>
                  <span className="text-muted">{txt.opportunitiesMetricTerrain}:</span>{" "}
                  {data.listing.areaTerrainM2 != null ? `${data.listing.areaTerrainM2.toFixed(1)} m²` : "—"}
                </p>
              </div>
              <a
                href={data.listing.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
              >
                {txt.analyzeOpenSource}
              </a>
            </Card>

            {enrichmentRows.length > 0 ? (
              <Card className="border-slate-200/90 shadow-card">
                <h2 className="text-lg font-semibold text-foreground">{txt.analyzeEnrichment}</h2>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {enrichmentRows.map((row) => (
                    <p key={row.label}>
                      <span className="text-muted">{row.label}:</span> {row.value}
                    </p>
                  ))}
                </div>
              </Card>
            ) : null}

            {priceTimelinePoints.length >= 2 ? (
              <Card className="border-slate-200/90 shadow-card">
                <h2 className="text-lg font-semibold text-foreground">{txt.analyzePriceTimeline}</h2>
                <PriceTimelineChart
                  points={priceTimelinePoints}
                  locale={locale}
                  noDataLabel={txt.analyzePriceTimelineEmpty}
                  tooltipLabel={txt.analyzePriceTimelineTooltip}
                />
              </Card>
            ) : null}

            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-elevated shadow-card dark:border-slate-700/80">
              <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3 text-sm font-semibold text-foreground dark:border-slate-700/80">
                {txt.analyzeComparableListings}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
                  <thead className="bg-surface/80">
                    <tr>
                      <th className="px-4 py-3 font-medium text-muted">{txt.listing}</th>
                      <th className="px-4 py-3 font-medium text-muted">{txt.neighborhood}</th>
                      <th className="px-4 py-3 font-medium text-muted">{txt.distance}</th>
                      <th className="px-4 py-3 font-medium text-muted">{txt.price}</th>
                      <th className="px-4 py-3 font-medium text-muted">{txt.pricePerM2}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.comps.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-muted" colSpan={5}>
                          {txt.analyzeNoComps}
                        </td>
                      </tr>
                    ) : (
                      data.comps.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3">
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-accent hover:underline"
                            >
                              {c.title}
                            </a>
                          </td>
                          <td className="px-4 py-3">{c.neighborhood ?? txt.unknown}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {c.distanceMeters != null
                              ? `${(c.distanceMeters / 1000).toFixed(2)} km`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {fmtCop(Number(c.priceCop), locale)}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{fmtCop(c.pricePerM2, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-background/90 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-700/80 sm:hidden">
        <Button
          type="submit"
          form="analyze-url-form"
          disabled={loading}
          className="w-full py-3.5 shadow-lg disabled:opacity-60"
        >
          {loading ? txt.analyzeUrlLoading : txt.analyzeUrlSubmit}
        </Button>
      </div>
      <PageFooter />
    </div>
  )
}
