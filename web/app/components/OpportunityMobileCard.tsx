"use client"

type Props = {
  title: string
  url: string
  location: string
  price: string
  pricePerM2: string
  discount: string
  dealScore: string
  confidence: string
  priceLabel: string
  pricePerM2Label: string
  discountLabel: string
  dealScoreLabel: string
  tags: string[]
  expanded: boolean
  expandLabel: string
  collapseLabel: string
  onToggle: () => void
  children?: React.ReactNode
}

export default function OpportunityMobileCard({
  title,
  url,
  location,
  price,
  pricePerM2,
  discount,
  dealScore,
  confidence,
  priceLabel,
  pricePerM2Label,
  discountLabel,
  dealScoreLabel,
  tags,
  expanded,
  expandLabel,
  collapseLabel,
  onToggle,
  children,
}: Props) {
  return (
    <article className="rounded-xl border border-slate-200/90 bg-elevated p-4 shadow-sm dark:border-slate-700/80">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-accent hover:underline"
      >
        {title}
      </a>
      <p className="mt-1 text-xs text-muted">{location}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted">{priceLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{price}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{pricePerM2Label}</p>
          <p className="font-semibold tabular-nums text-foreground">{pricePerM2}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{discountLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{discount}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{dealScoreLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{dealScore}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{confidence}</p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded-lg border border-slate-200 bg-surface py-2 text-xs font-semibold text-foreground dark:border-slate-600"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? collapseLabel : expandLabel}
      </button>
      {expanded && children ? (
        <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-700">{children}</div>
      ) : null}
    </article>
  )
}
