"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import Card from "@/app/components/ui/Card"
import SearchableSelect, { matchesSearchQuery } from "@/app/components/ui/SearchableSelect"
import { localePath, type Locale } from "@/lib/locale"
import { uiText } from "@/lib/i18n"

export type CityZoneItem = {
  slug: string
  displayName: string
  listingCount: number
  medianPricePerM2: number | null
}

type Props = {
  zones: CityZoneItem[]
  citySlug: string
  locale: Locale
}

function fmtCop(v: number | null, locale: Locale) {
  if (v == null) return "—"
  const loc = locale === "es" ? "es-CO" : "en-US"
  return `$ ${Math.round(v).toLocaleString(loc)}`
}

function fmtTemplate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

export default function CityZoneDirectory({ zones, citySlug, locale }: Props) {
  const router = useRouter()
  const txt = uiText[locale]
  const lp = (path: string) => localePath(locale, path)
  const numberLocale = locale === "es" ? "es-CO" : "en-US"

  const [filterQuery, setFilterQuery] = useState("")

  const options = useMemo(
    () =>
      zones.map((zone) => ({
        value: zone.slug,
        label: zone.displayName,
      })),
    [zones],
  )

  const filteredZones = useMemo(() => {
    if (!filterQuery.trim()) return zones
    return zones.filter((zone) =>
      matchesSearchQuery(zone.displayName, filterQuery, "contains"),
    )
  }, [filterQuery, zones])

  const handleSelect = useCallback(
    (slug: string) => {
      if (!slug) return
      router.push(lp(`/zones/${citySlug}/${slug}`))
    },
    [citySlug, lp, router],
  )

  const handleQueryChange = useCallback((query: string) => {
    setFilterQuery(query)
  }, [])

  if (zones.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{txt.zonesEmpty}</p>
      </Card>
    )
  }

  return (
    <>
      <Card className="mb-6 border-slate-200/90 p-4 shadow-card">
        <label className="block text-xs font-medium text-muted" htmlFor="city-zone-search">
          {txt.zonesSearchLabel}
        </label>
        <SearchableSelect
          id="city-zone-search"
          options={options}
          value=""
          onChange={handleSelect}
          onQueryChange={handleQueryChange}
          filterMode="contains"
          placeholder={txt.zonesSearchPlaceholder}
          noResultsLabel={txt.zonesSearchNoResults}
          aria-label={txt.zonesSearchPlaceholder}
          className="mt-1.5 max-w-xl"
        />
        {filterQuery.trim() ? (
          <p className="mt-2 text-xs text-muted">
            {fmtTemplate(txt.zonesSearchResults, { count: filteredZones.length })}
          </p>
        ) : null}
      </Card>

      {filteredZones.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{txt.zonesSearchNoResults}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredZones.map((zone) => (
            <Link
              key={zone.slug}
              href={lp(`/zones/${citySlug}/${zone.slug}`)}
              className="block rounded-2xl border border-slate-200/90 bg-elevated p-5 transition hover:border-teal-300 dark:border-slate-700/80"
            >
              <p className="font-semibold text-foreground">{zone.displayName}</p>
              <p className="mt-2 text-sm text-muted">
                {zone.listingCount.toLocaleString(numberLocale)}{" "}
                {locale === "en" ? "active listings" : "publicaciones activas"}
              </p>
              {zone.medianPricePerM2 != null ? (
                <p className="mt-2 text-sm font-semibold tabular-nums text-accent">
                  {locale === "en" ? "Median / m²" : "Mediana / m²"}:{" "}
                  {fmtCop(zone.medianPricePerM2, locale)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
