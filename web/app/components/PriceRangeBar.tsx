"use client"

type Props = {
  low: number
  mid: number
  high: number
  locale: string
  lowLabel: string
  midLabel: string
  highLabel: string
}

function fmtMoney(n: number, locale: string) {
  return `$ ${Math.round(n).toLocaleString(locale)}`
}

export default function PriceRangeBar({
  low,
  mid,
  high,
  locale,
  lowLabel,
  midLabel,
  highLabel,
}: Props) {
  const span = high - low
  const midPct = span > 0 ? Math.min(100, Math.max(0, ((mid - low) / span) * 100)) : 50

  return (
    <div className="space-y-4">
      <div className="relative pt-8">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-teal-200 via-teal-500 to-cyan-600 dark:from-teal-900 dark:via-teal-600 dark:to-cyan-500"
          role="presentation"
        />
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${midPct}%` }}
        >
          <span className="block whitespace-nowrap rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-accent-fg shadow-sm">
            {fmtMoney(mid, locale)}
          </span>
          <span
            className="mx-auto mt-1 block h-3 w-3 rounded-full border-2 border-white bg-accent shadow dark:border-slate-900"
            aria-hidden
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
        <div>
          <p className="font-medium text-muted">{lowLabel}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
            {fmtMoney(low, locale)}
          </p>
        </div>
        <div className="text-center">
          <p className="font-medium text-muted">{midLabel}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
            {fmtMoney(mid, locale)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-muted">{highLabel}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
            {fmtMoney(high, locale)}
          </p>
        </div>
      </div>
    </div>
  )
}
