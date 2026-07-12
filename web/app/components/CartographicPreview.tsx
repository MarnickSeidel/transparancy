"use client"

import Link from "next/link"

type ZoneDot = {
  name: string
  href: string
  medianPricePerM2: number | null
  listingCount: number
}

type Props = {
  cityName: string
  zones: ZoneDot[]
  locale: string
  heatmapHref: string
  labels: {
    title: string
    viewMap: string
    median: string
    listings: string
  }
}

/** Stylized cartographic preview — hex grid with zone markers */
export default function CartographicPreview({
  cityName,
  zones,
  locale,
  heatmapHref,
  labels,
}: Props) {
  const positions = [
    { top: "18%", left: "22%" },
    { top: "35%", left: "58%" },
    { top: "52%", left: "30%" },
    { top: "68%", left: "65%" },
    { top: "42%", left: "78%" },
    { top: "72%", left: "18%" },
  ]

  return (
    <div className="surface-hero relative isolate overflow-hidden rounded-2xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0-12l20-12V22L28 10 8 22v22l20 12z' fill='none' stroke='%23c45c26' stroke-opacity='0.15' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "42px 75px",
        }}
        aria-hidden
      />
      <div className="relative flex min-h-[280px] flex-col p-5 sm:min-h-[320px] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-section-label">{labels.title}</p>
            <p className="text-display mt-1 text-xl font-semibold">{cityName}</p>
          </div>
          <Link
            href={heatmapHref}
            className="relative z-10 shrink-0 cursor-pointer rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
          >
            {labels.viewMap}
          </Link>
        </div>

        <div className="relative mt-4 min-h-[180px] sm:min-h-[200px]">
          {zones.slice(0, 6).map((zone, i) => {
            const pos = positions[i] ?? positions[0]
            return (
              <Link
                key={zone.href}
                href={zone.href}
                className="absolute z-10 max-w-[140px] cursor-pointer rounded-lg border border-border-subtle bg-elevated px-2.5 py-2 shadow-sm transition hover:border-accent/40 hover:shadow-md"
                style={{ top: pos.top, left: pos.left }}
              >
                <p className="truncate text-xs font-semibold text-foreground">{zone.name}</p>
                {zone.medianPricePerM2 != null ? (
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted">
                    {labels.median}: ${Math.round(zone.medianPricePerM2).toLocaleString(locale)}
                  </p>
                ) : null}
                <p className="text-[10px] text-muted">
                  {zone.listingCount.toLocaleString(locale)} {labels.listings}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
