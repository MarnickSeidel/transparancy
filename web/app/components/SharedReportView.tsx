"use client"

import dynamic from "next/dynamic"

import DomBadge from "@/app/components/DomBadge"
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection"
import ShareReportActions from "@/app/components/ShareReportActions"
import VerdictBanner from "@/app/components/VerdictBanner"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import Skeleton from "@/app/components/ui/Skeleton"
import WhyDealPanel from "@/app/components/WhyDealPanel"
import type { WhyDeal } from "@/lib/dealEngine"
import { dealWarningLabel } from "@/lib/dealLabels"
import { formatDomDays } from "@/lib/formatDom"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { localePath } from "@/lib/locale"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import type { SharedAnalyzePayload } from "@/lib/shareReport"

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full" />,
})

type Props = {
  payload: SharedAnalyzePayload
  lang: Lang
  createdAt?: string | null
  showShareActions?: boolean
}

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

export default function SharedReportView({
  payload,
  lang,
  createdAt,
  showShareActions = true,
}: Props) {
  const txt = uiText[lang]
  const locale = lang === "es" ? "es-CO" : "en-US"
  const domLabel = formatDomDays(payload.analysis.domDays, lang)

  const priceTimelinePoints = (payload.priceTimeline ?? []).map((p) => ({
    recordedAt: p.recordedAt,
    priceCop: Number(p.priceCop),
  }))

  return (
    <div className="space-y-6">
      {createdAt ? (
        <p className="text-xs text-muted">
          {txt.shareReportGenerated}:{" "}
          {new Date(createdAt).toLocaleString(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      ) : null}

      <VerdictBanner
        verdict={payload.analysis.verdict}
        confidence={payload.analysis.confidence}
        dealScore={payload.analysis.dealScore}
        discountPct={payload.analysis.discountVsRefPct}
        sampleSize={payload.analysis.sampleSize}
        lang={lang}
        locale={locale}
        listingPpm2={payload.listing.pricePerM2}
        referencePpm2={payload.analysis.referencePpm2}
        priceCop={payload.listing.priceCop}
        city={payload.listing.city}
        neighborhood={payload.listing.neighborhood}
        estrato={payload.listing.estrato}
        propertyType={payload.listing.propertyType}
        compMethod={
          payload.analysis.compMethod ??
          (payload.analysis.whyDeal as { compMethod?: string } | undefined)?.compMethod
        }
        metricType={
          payload.analysis.metricType ??
          (payload.analysis.whyDeal as { metricType?: string } | undefined)?.metricType
        }
        priceDropPct={payload.analysis.priceDropPct}
        domDays={payload.analysis.domDays}
      />

      {showShareActions ? (
        <Card className="border-slate-200/90 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">{txt.shareReportTitle}</h2>
          <p className="mt-1 text-xs text-muted">{txt.shareReportHint}</p>
          <div className="mt-3">
            <ShareReportActions payload={payload} lang={lang} />
          </div>
        </Card>
      ) : null}

      {payload.analysis.whyDeal ? (
        <WhyDealPanel
          whyDeal={payload.analysis.whyDeal as WhyDeal}
          title={txt.analyzeWhyDeal}
          lang={lang}
          locale={locale}
        />
      ) : null}

      <Card className="border-slate-200/90 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{txt.analyzeListingSnapshot}</h2>
          {domLabel ? <DomBadge days={payload.analysis.domDays} lang={lang} label={domLabel} /> : null}
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">{txt.listing}:</span> {payload.listing.title}
          </p>
          <p>
            <span className="text-muted">{txt.city}:</span> {payload.listing.city}
          </p>
          <p>
            <span className="text-muted">{txt.neighborhood}:</span>{" "}
            {payload.listing.neighborhood ?? txt.unknown}
          </p>
          <p>
            <span className="text-muted">{txt.type}:</span>{" "}
            {propertyTypeLabel(payload.listing.propertyType, lang)}
          </p>
          <p>
            <span className="text-muted">{txt.price}:</span>{" "}
            {fmtCop(Number(payload.listing.priceCop), locale)}
          </p>
          <p>
            <span className="text-muted">{txt.pricePerM2}:</span>{" "}
            {fmtCop(payload.listing.pricePerM2, locale)}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button href={payload.listing.url} variant="secondary">
            {txt.analyzeOpenSource}
          </Button>
          <Button href={localePath(lang, "/analyze-url")} variant="secondary">
            {txt.shareReportAnalyzeAnother}
          </Button>
        </div>
        {payload.analysis.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
            {payload.analysis.warnings.map((w) => (
              <li key={w}>{dealWarningLabel(w, lang)}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <NearbyAmenitiesSection
        latitude={payload.listing.latitude}
        longitude={payload.listing.longitude}
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
                <th className="px-4 py-3 font-medium text-muted">{txt.price}</th>
                <th className="px-4 py-3 font-medium text-muted">{txt.pricePerM2}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payload.comps.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted" colSpan={4}>
                    {txt.analyzeNoComps}
                  </td>
                </tr>
              ) : (
                payload.comps.map((c) => (
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
                    <td className="px-4 py-3 tabular-nums">{fmtCop(Number(c.priceCop), locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(c.pricePerM2, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
