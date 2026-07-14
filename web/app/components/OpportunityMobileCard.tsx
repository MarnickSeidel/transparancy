"use client"

import DealComparisonBar from "@/app/components/DealComparisonBar"
import ListingThumbnail from "@/app/components/ListingThumbnail"

type Props = {
  title: string
  detailHref: string
  location: string
  price: string
  pricePerM2: string
  pricePerM2Num?: number | null
  refAvg?: number | null
  locale?: string
  discount: string
  dealScore: string
  confidence: string
  sampleSize?: number | null
  imageUrl?: string | null
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
  detailHref,
  location,
  price,
  pricePerM2,
  pricePerM2Num,
  refAvg,
  locale = "es-CO",
  discount,
  dealScore,
  confidence,
  sampleSize,
  imageUrl,
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
    <article className="surface-inline p-4">
      <div className="flex gap-3">
        <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
          {imageUrl ? (
            <ListingThumbnail src={imageUrl} alt={title} width={64} height={56} sizes="64px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={detailHref}
            className="font-semibold text-accent hover:underline"
          >
            {title}
          </a>
          <p className="mt-0.5 text-meta">{location}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-meta">{priceLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{price}</p>
        </div>
        <div>
          <p className="text-meta">{pricePerM2Label}</p>
          <p className="font-semibold tabular-nums text-foreground">{pricePerM2}</p>
        </div>
        <div>
          <p className="text-meta">{discountLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{discount}</p>
        </div>
        <div>
          <p className="text-meta">{dealScoreLabel}</p>
          <p className="font-semibold tabular-nums text-foreground">{dealScore}</p>
        </div>
      </div>
      {pricePerM2Num != null && refAvg != null ? (
        <DealComparisonBar
          subject={pricePerM2Num}
          reference={refAvg}
          locale={locale}
          className="mt-3"
        />
      ) : null}
      <p className="mt-2 text-meta">
        {confidence}
        {sampleSize != null ? ` · n=${sampleSize}` : ""}
      </p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-200"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded-lg border border-border-subtle bg-surface py-2 text-xs font-semibold text-foreground"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? collapseLabel : expandLabel}
      </button>
      {expanded && children ? (
        <div className="mt-3 border-t border-border-subtle pt-3">{children}</div>
      ) : null}
    </article>
  )
}
