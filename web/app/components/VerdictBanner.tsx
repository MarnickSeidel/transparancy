"use client"

import Link from "next/link"

import Badge from "@/app/components/ui/Badge"
import TrustMeta from "@/app/components/TrustMeta"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

type Verdict = "good_deal" | "fair" | "overpriced"
type Confidence = "high" | "medium" | "low"

type Props = {
  verdict: Verdict
  confidence: Confidence
  dealScore: number | null
  discountPct: number | null
  sampleSize?: number | null
  lang: Lang
}

const verdictStyles: Record<Verdict, string> = {
  good_deal: "border-deal-good/30 bg-deal-good/8",
  fair: "border-border-subtle bg-surface/50",
  overpriced: "border-deal-bad/30 bg-deal-bad/8",
}

const verdictBadge: Record<Verdict, "good" | "default" | "bad"> = {
  good_deal: "good",
  fair: "default",
  overpriced: "bad",
}

export default function VerdictBanner({
  verdict,
  confidence,
  dealScore,
  discountPct,
  sampleSize,
  lang,
}: Props) {
  const txt = uiText[lang]

  const verdictLabel =
    verdict === "good_deal"
      ? txt.analyzeVerdictGood
      : verdict === "overpriced"
        ? txt.analyzeVerdictOverpriced
        : txt.analyzeVerdictFair

  const confidenceLabel =
    confidence === "high"
      ? txt.confidenceHigh
      : confidence === "medium"
        ? txt.confidenceMedium
        : txt.confidenceLow

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
        <Badge variant={verdictBadge[verdict]}>{confidenceLabel}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-meta">{txt.dealScore}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {dealScore != null && Number.isFinite(dealScore) ? dealScore.toFixed(1) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-meta">{txt.opportunityDiscount}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {discountPct != null && Number.isFinite(discountPct)
              ? `${discountPct.toFixed(1)}%`
              : "—"}
          </dd>
        </div>
      </dl>
      <TrustMeta
        className="mt-3"
        sampleSize={sampleSize}
        labels={{
          sample: txt.sample,
          confidence: lang === "en" ? "Confidence" : "Confianza",
          updated: txt.updated,
        }}
      />
      <Link
        href={lang === "en" ? "/en/methodology" : "/methodology"}
        className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
      >
        {lang === "en" ? "How we calculate this →" : "Cómo calculamos esto →"}
      </Link>
    </section>
  )
}
