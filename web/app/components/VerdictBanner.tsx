"use client"

import Badge from "@/app/components/ui/Badge"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

type Verdict = "good_deal" | "fair" | "overpriced"
type Confidence = "high" | "medium" | "low"

type Props = {
  verdict: Verdict
  confidence: Confidence
  dealScore: number | null
  discountPct: number | null
  lang: Lang
}

const verdictStyles: Record<Verdict, string> = {
  good_deal:
    "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-800/50 dark:from-emerald-950/40 dark:to-teal-950/30",
  fair:
    "border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100 dark:border-slate-700/60 dark:from-slate-900/60 dark:to-slate-800/40",
  overpriced:
    "border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-50 dark:border-rose-900/50 dark:from-rose-950/40 dark:to-orange-950/30",
}


export default function VerdictBanner({
  verdict,
  confidence,
  dealScore,
  discountPct,
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
      className={`rounded-2xl border p-5 shadow-card sm:p-6 ${verdictStyles[verdict]}`}
      aria-label={txt.analyzeVerdict}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {txt.analyzeVerdict}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {verdictLabel}
          </p>
        </div>
        <Badge className={verdict === "good_deal" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : verdict === "overpriced" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" : ""}>
          {confidenceLabel}
        </Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{txt.dealScore}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {dealScore != null && Number.isFinite(dealScore) ? dealScore.toFixed(1) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{txt.opportunityDiscount}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {discountPct != null && Number.isFinite(discountPct)
              ? `${discountPct.toFixed(1)}%`
              : "—"}
          </dd>
        </div>
      </dl>
    </section>
  )
}
