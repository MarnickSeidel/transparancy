"use client"

import Link from "next/link"

import DealComparisonBar from "@/app/components/DealComparisonBar"
import DomBadge from "@/app/components/DomBadge"
import Badge from "@/app/components/ui/Badge"
import TrustMeta from "@/app/components/TrustMeta"
import {
  compMethodLabel,
  confidenceLabel,
  dealReviewLabels,
  metricTypeLabel,
} from "@/lib/dealLabels"
import type { DealReview, DealVerdict } from "@/lib/dealReview"
import { formatDomDays } from "@/lib/formatDom"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { propertyTypeLabel } from "@/lib/propertyTypes"

type Verdict = DealVerdict
type Confidence = "high" | "medium" | "low"

type Props = {
  verdict: Verdict
  review?: DealReview | null
  confidence: Confidence
  dealScore: number | null
  discountPct: number | null
  sampleSize?: number | null
  lang: Lang
  locale?: string
  listingPpm2?: number | null
  referencePpm2?: number | null
  priceCop?: number | string | null
  city?: string | null
  neighborhood?: string | null
  estrato?: number | null
  propertyType?: string | null
  compMethod?: string | null
  metricType?: string | null
  priceDropPct?: number | null
  domDays?: number | null
}

const verdictStyles: Record<Verdict, string> = {
  good_deal: "border-deal-good/30 bg-deal-good/8",
  review: "border-amber-500/40 bg-amber-500/8",
  fair: "border-border-subtle bg-surface/50",
  overpriced: "border-deal-bad/30 bg-deal-bad/8",
}

const verdictBadge: Record<Verdict, "good" | "warn" | "default" | "bad"> = {
  good_deal: "good",
  review: "warn",
  fair: "default",
  overpriced: "bad",
}

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

function buildContextLine(
  props: Pick<Props, "neighborhood" | "city" | "estrato" | "propertyType" | "lang">,
): string | null {
  const parts: string[] = []
  if (props.neighborhood?.trim()) parts.push(props.neighborhood.trim())
  if (props.city?.trim()) parts.push(props.city.trim())
  if (props.estrato != null && Number.isFinite(props.estrato)) {
    parts.push(`${uiText[props.lang].estrato} ${props.estrato}`)
  }
  if (props.propertyType) {
    parts.push(propertyTypeLabel(props.propertyType, props.lang))
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

function buildSummary(
  verdict: Verdict,
  discountPct: number | null,
  context: string | null,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
): string | null {
  if (!context) return null
  const pct =
    discountPct != null && Number.isFinite(discountPct)
      ? Math.abs(discountPct).toFixed(1)
      : null

  if (verdict === "review" && pct) {
    return txt.analyzeVerdictSummaryReview.replace("{pct}", pct).replace("{context}", context)
  }
  if (verdict === "good_deal" && pct) {
    return txt.analyzeVerdictSummaryGood.replace("{pct}", pct).replace("{context}", context)
  }
  if (verdict === "overpriced" && pct) {
    return txt.analyzeVerdictSummaryOver.replace("{pct}", pct).replace("{context}", context)
  }
  return txt.analyzeVerdictSummaryFair.replace("{context}", context)
}

export default function VerdictBanner({
  verdict,
  review,
  confidence,
  dealScore,
  discountPct,
  sampleSize,
  lang,
  locale: localeProp,
  listingPpm2,
  referencePpm2,
  priceCop,
  city,
  neighborhood,
  estrato,
  propertyType,
  compMethod,
  metricType,
  priceDropPct,
  domDays,
}: Props) {
  const txt = uiText[lang]
  const locale = localeProp ?? (lang === "es" ? "es-CO" : "en-US")
  const domLabel = formatDomDays(domDays, lang)

  const insufficientComps =
    sampleSize == null ||
    sampleSize === 0 ||
    referencePpm2 == null ||
    !Number.isFinite(referencePpm2) ||
    referencePpm2 <= 0

  const localizedConfidence = insufficientComps
    ? confidenceLabel("low", lang)
    : confidenceLabel(confidence, lang)

  const contextLine = buildContextLine({
    neighborhood,
    city,
    estrato,
    propertyType,
    lang,
  })

  const verdictLabel = insufficientComps
    ? txt.analyzeVerdictInsufficient
    : verdict === "good_deal"
      ? txt.analyzeVerdictGood
      : verdict === "review"
        ? txt.analyzeVerdictReview
      : verdict === "overpriced"
        ? txt.analyzeVerdictOverpriced
        : txt.analyzeVerdictFair

  const summary = insufficientComps
    ? contextLine
      ? txt.analyzeVerdictSummaryInsufficient.replace("{context}", contextLine)
      : txt.analyzeNoComps
    : buildSummary(verdict, discountPct, contextLine, txt)

  const totalPrice =
    priceCop != null
      ? typeof priceCop === "string"
        ? Number(priceCop)
        : priceCop
      : null

  const compLine =
    sampleSize != null && sampleSize > 0
      ? txt.analyzeVerdictCompLine
          .replace("{count}", String(sampleSize))
          .replace("{method}", compMethodLabel(compMethod ?? undefined, lang))
          .replace("{metric}", metricTypeLabel(metricType ?? undefined, lang))
      : null

  const showComparison =
    listingPpm2 != null &&
    referencePpm2 != null &&
    Number.isFinite(listingPpm2) &&
    Number.isFinite(referencePpm2) &&
    referencePpm2 > 0

  const reviewLines = insufficientComps ? [] : dealReviewLabels(review, lang)

  const priceDropChip =
    priceDropPct != null && Number.isFinite(priceDropPct) && priceDropPct > 0
      ? txt.analyzeVerdictPriceDrop.replace("{pct}", priceDropPct.toFixed(1))
      : null

  return (
    <section
      className={`surface-hero border p-5 sm:p-6 ${verdictStyles[verdict]}`}
      aria-label={txt.analyzeVerdict}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-section-label">{txt.analyzeVerdict}</p>
          <p className="text-display mt-1 text-2xl font-semibold sm:text-3xl">{verdictLabel}</p>
        </div>
        <Badge variant={insufficientComps ? "default" : verdictBadge[verdict]}>
          {localizedConfidence}
        </Badge>
      </div>

      {contextLine ? (
        <p className="mt-2 text-sm text-muted">{contextLine}</p>
      ) : null}

      {summary ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{summary}</p>
      ) : null}

      {reviewLines.length > 0 ? (
        <div
          className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="note"
        >
          <p className="font-semibold">{txt.reviewReasonsTitle}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {reviewLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showComparison ? (
        <DealComparisonBar
          className="mt-4"
          subject={listingPpm2!}
          reference={referencePpm2!}
          locale={locale}
          label={txt.analyzeVerdictComparison}
        />
      ) : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-meta">{txt.analyzeVerdictListingPpm2}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {fmtCop(listingPpm2, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta">{txt.analyzeVerdictReferencePpm2}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {fmtCop(referencePpm2, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta">{txt.analyzeVerdictTotalPrice}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {fmtCop(totalPrice, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta">{txt.dealScore}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {dealScore != null && Number.isFinite(dealScore) ? dealScore.toFixed(1) : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {compLine ? (
          <span className="rounded-full border border-border-subtle bg-surface/80 px-2.5 py-1 text-xs text-muted">
            {compLine}
          </span>
        ) : null}
        {priceDropChip ? (
          <span className="rounded-full border border-deal-good/30 bg-deal-good/10 px-2.5 py-1 text-xs font-medium text-deal-good">
            {priceDropChip}
          </span>
        ) : null}
        {domLabel ? <DomBadge days={domDays} lang={lang} label={domLabel} /> : null}
        {discountPct != null && Number.isFinite(discountPct) ? (
          <span className="rounded-full border border-border-subtle bg-surface/80 px-2.5 py-1 text-xs tabular-nums text-muted">
            {txt.opportunityDiscount}: {discountPct.toFixed(1)}%
          </span>
        ) : null}
      </div>

      <TrustMeta
        className="mt-3"
        sampleSize={sampleSize}
        confidence={confidence}
        confidenceText={localizedConfidence}
        labels={{
          sample: txt.sample,
          confidence: txt.analyzeVerdictConfidenceLabel,
          updated: txt.updated,
        }}
      />

      <Link
        href={lang === "en" ? "/en/methodology" : "/methodology"}
        className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
      >
        {txt.analyzeVerdictHowWeCalculate}
      </Link>
    </section>
  )
}
