"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo } from "react"

import DomBadge from "@/app/components/DomBadge"
import ListingThumbnail from "@/app/components/ListingThumbnail"
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection"
import PageFooter from "@/app/components/PageFooter"
import ShareReportActions from "@/app/components/ShareReportActions"
import SiteHeader from "@/app/components/SiteHeader"
import ToolNextSteps from "@/app/components/ToolNextSteps"
import VerdictBanner from "@/app/components/VerdictBanner"
import WhyDealPanel from "@/app/components/WhyDealPanel"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import Skeleton from "@/app/components/ui/Skeleton"
import { dealWarningLabel } from "@/lib/dealLabels"
import { formatDomDays } from "@/lib/formatDom"
import { formatFreshnessDate } from "@/lib/getDataFreshness"
import type { ListingDetailResponse } from "@/lib/getListingDetail"
import { uiText } from "@/lib/i18n"
import { listingPath, opportunitiesPath, type Locale } from "@/lib/locale"
import { buildListingContextLinks } from "@/lib/listingContextLinks"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import type { SharedAnalyzePayload } from "@/lib/shareReport"
import { useUiLang } from "@/lib/useUiLang"

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full" />,
})

type Props = {
  data: ListingDetailResponse
  pageLocale?: Locale
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

export default function ListingDetailView({ data, pageLocale = "es" }: Props) {
  const { lang, toggleLang } = useUiLang(pageLocale)
  const txt = uiText[lang]
  const locale = lang === "es" ? "es-CO" : "en-US"

  const sharePayload = useMemo((): SharedAnalyzePayload => ({
    listing: {
      title: data.listing.title,
      url: data.listing.url,
      city: data.listing.city,
      neighborhood: data.listing.neighborhood,
      propertyType: data.listing.propertyType,
      operationType: data.listing.operationType,
      priceCop: data.listing.priceCop,
      areaM2: data.listing.areaM2,
      areaBuiltM2: data.listing.areaBuiltM2,
      areaPrivateM2: data.listing.areaPrivateM2,
      areaTerrainM2: data.listing.areaTerrainM2,
      areaTerraceM2: data.listing.areaTerraceM2,
      estrato: data.listing.estrato,
      bedrooms: data.listing.bedrooms,
      bathrooms: data.listing.bathrooms,
      garage: data.listing.garage,
      pricePerM2: data.listing.pricePerM2,
      constructionState: data.listing.constructionState,
      facilities: data.listing.facilities,
      latitude: data.listing.latitude,
      longitude: data.listing.longitude,
    },
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
      compMethod: data.analysis.compMethod,
      metricType: data.analysis.metricType,
      whyDeal: data.analysis.whyDeal,
      domDays: data.analysis.domDays,
      priceDropPct: data.analysis.priceDropPct,
    },
    priceTimeline: data.priceTimeline,
    comps: data.comps,
  }), [data])

  const enrichmentRows = useMemo(() => {
    const l = data.listing
    const rows: Array<{ label: string; value: string }> = []
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
  }, [data.listing, txt])

  const priceTimelinePoints = useMemo(
    () =>
      data.priceTimeline.map((p) => ({
        recordedAt: p.recordedAt,
        priceCop: Number(p.priceCop),
      })),
    [data.priceTimeline],
  )

  const domLabel = formatDomDays(data.analysis.domDays, lang)
  const updatedLabel = data.listing.sourceUpdatedAt
    ? formatFreshnessDate(new Date(data.listing.sourceUpdatedAt), locale)
    : null

  const opportunitiesHref = useMemo(() => {
    const p = new URLSearchParams()
    p.set("city", data.listing.city)
    if (data.listing.neighborhood) p.set("neighborhood", data.listing.neighborhood)
    if (data.listing.propertyType) p.set("propertyType", data.listing.propertyType)
    return opportunitiesPath(lang, p.toString())
  }, [data.listing.city, data.listing.neighborhood, data.listing.propertyType, lang])

  const nextSteps = useMemo(() => {
    const links = buildListingContextLinks({
      lang,
      city: data.listing.city,
      neighborhood: data.listing.neighborhood,
      propertyType: data.listing.propertyType,
      estrato: data.listing.estrato,
      areaM2: data.listing.areaM2,
    })
    const nb = data.listing.neighborhood?.trim()
    return [
      links.zoneHref
        ? {
            title: nb
              ? txt.nextStepsZoneBarrio.replace("{barrio}", nb)
              : txt.nextStepsZonesTitle,
            description: txt.nextStepsZonesDesc,
            href: links.zoneHref,
            cta: txt.zonesNav,
          }
        : null,
      {
        title: nb
          ? txt.nextStepsExploreBarrio.replace("{barrio}", nb)
          : txt.nextStepsExploreTitle,
        description: txt.nextStepsExploreDesc,
        href: links.exploreHref,
        cta: txt.exploreNav,
      },
      {
        title: txt.nextStepsAnalyzeTitle,
        description: txt.nextStepsAnalyzeDesc,
        href: links.analyzeHref,
        cta: txt.analyzeUrlNav,
      },
    ].filter((step): step is NonNullable<typeof step> => step != null).slice(0, 3)
  }, [data.listing, lang, txt])

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={data.listing.title}
        subtitle={txt.listingDetailPurpose}
        active="opportunities"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={opportunitiesPath(lang)}
            className="text-sm font-medium text-accent hover:underline"
          >
            ← {txt.listingDetailBack}
          </Link>
          {updatedLabel ? (
            <p className="text-xs text-muted">
              {txt.listingDetailUpdated}: {updatedLabel}
            </p>
          ) : null}
        </div>

        {!data.listing.isActive ? (
          <div
            className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card"
            role="status"
          >
            <p className="font-semibold">{txt.listingDetailInactive}</p>
            <p className="mt-1 text-amber-900/90">{txt.listingDetailInactiveBody}</p>
          </div>
        ) : null}

        <Card className="mb-6 overflow-hidden border-border-subtle p-0 shadow-card">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
            <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-surface sm:h-28 sm:w-40">
              {data.listing.imageUrl ? (
                <ListingThumbnail
                  src={data.listing.imageUrl}
                  alt={data.listing.title}
                  width={320}
                  height={224}
                  sizes="(max-width: 640px) 100vw, 160px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">—</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-foreground">{data.listing.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {data.listing.city}
                {data.listing.neighborhood ? ` · ${data.listing.neighborhood}` : ""}
                {data.listing.zoneName ? ` (${data.listing.zoneName})` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <p>
                  <span className="text-muted">{txt.price}:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {fmtCop(Number(data.listing.priceCop), locale)}
                  </span>
                </p>
                <p>
                  <span className="text-muted">{txt.pricePerM2}:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {fmtCop(data.listing.pricePerM2, locale)}
                  </span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={data.listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-hover"
                >
                  {txt.listingDetailCtaFr}
                </a>
                <Button href={opportunitiesHref} variant="secondary">
                  {txt.analyzeFindSimilar}
                </Button>
              </div>
            </div>
          </div>
        </Card>

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
            compMethod={data.analysis.compMethod}
            metricType={data.analysis.metricType}
            priceDropPct={data.analysis.priceDropPct}
            domDays={data.analysis.domDays}
          />

          <Card className="border-slate-200/90 shadow-card">
            <h2 className="text-sm font-semibold text-foreground">{txt.shareReportTitle}</h2>
            <p className="mt-1 text-xs text-muted">{txt.shareReportHint}</p>
            <div className="mt-3">
              <ShareReportActions payload={sharePayload} lang={lang} />
            </div>
          </Card>

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
                {fmtCop(data.analysis.referencePpm2Nearby, locale)}
              </p>
              <p>
                <span className="text-muted">{txt.analyzeReferencePpm2Neighborhood}:</span>{" "}
                {fmtCop(data.analysis.referencePpm2Neighborhood, locale)}
              </p>
              <p>
                <span className="text-muted">{txt.sample}:</span> {data.analysis.sampleSize}
              </p>
            </div>
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
              rel="noopener noreferrer"
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

          <NearbyAmenitiesSection
            latitude={data.listing.latitude}
            longitude={data.listing.longitude}
            lang={lang}
            locale={locale}
          />

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
                          <Link
                            href={listingPath(lang, c.id)}
                            className="font-medium text-accent hover:underline"
                          >
                            {c.title}
                          </Link>
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

          <ToolNextSteps title={txt.nextStepsTitle} steps={nextSteps} />
        </div>
      </main>

      <PageFooter />
    </div>
  )
}
