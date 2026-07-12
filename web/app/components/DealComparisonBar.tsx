"use client"

type Props = {
  subject: number
  reference: number
  locale: string
  label?: string
  className?: string
}

function fmt(n: number, locale: string) {
  return `$ ${Math.round(n).toLocaleString(locale)}`
}

export default function DealComparisonBar({
  subject,
  reference,
  locale,
  label,
  className = "",
}: Props) {
  if (!Number.isFinite(subject) || !Number.isFinite(reference) || reference <= 0) {
    return null
  }

  const deltaPct = ((subject - reference) / reference) * 100
  const isBelow = deltaPct < -1
  const isAbove = deltaPct > 1
  const barColor = isBelow ? "bg-deal-good" : isAbove ? "bg-deal-bad" : "bg-deal-fair"

  const min = Math.min(subject, reference) * 0.85
  const max = Math.max(subject, reference) * 1.15
  const span = max - min
  const refPct = span > 0 ? ((reference - min) / span) * 100 : 50
  const subPct = span > 0 ? ((subject - min) / span) * 100 : 50

  return (
    <div className={className}>
      {label ? <p className="text-meta mb-1.5">{label}</p> : null}
      <div className="relative h-2 rounded-full bg-surface">
        <div
          className={`absolute top-0 h-full rounded-full opacity-80 ${barColor}`}
          style={{
            left: `${Math.min(refPct, subPct)}%`,
            width: `${Math.abs(subPct - refPct)}%`,
          }}
          role="presentation"
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/40"
          style={{ left: `${refPct}%` }}
          title={`Ref: ${fmt(reference, locale)}`}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-elevated bg-accent shadow-sm"
          style={{ left: `${subPct}%` }}
          title={`Listing: ${fmt(subject, locale)}`}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-meta tabular-nums">
        <span className={isBelow ? "font-semibold text-deal-good" : isAbove ? "font-semibold text-deal-bad" : ""}>
          {deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(1)}%
        </span>
        <span>{fmt(subject, locale)}/m²</span>
      </div>
    </div>
  )
}
