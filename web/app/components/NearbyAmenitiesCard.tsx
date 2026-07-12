"use client"

import { useMemo, useState } from "react"

import Card from "@/app/components/ui/Card"
import Skeleton from "@/app/components/ui/Skeleton"
import {
  formatDistanceM,
  type NearbyAmenitiesResult,
  type NearbyCategoryResult,
  type PoiCategoryId,
} from "@/lib/nearbyAmenities"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

type Props = {
  data: NearbyAmenitiesResult | null
  loading: boolean
  hasCoordinates: boolean
  lang: Lang
  locale: string
  compact?: boolean
}

const categoryLabel = (lang: Lang, id: PoiCategoryId): string => {
  const txt = uiText[lang]
  const labels: Record<PoiCategoryId, string> = {
    education: txt.nearbyAmenitiesCategoryEducation,
    health: txt.nearbyAmenitiesCategoryHealth,
    groceries: txt.nearbyAmenitiesCategoryGroceries,
    parks: txt.nearbyAmenitiesCategoryParks,
    transit: txt.nearbyAmenitiesCategoryTransit,
  }
  return labels[id]
}

const placeDisplayName = (
  place: NearbyCategoryResult["places"][number],
  lang: Lang,
): string => {
  if (place.name) return place.name
  const txt = uiText[lang]
  const subTypeLabels: Record<string, string> = {
    school: txt.nearbyAmenitiesSubTypeSchool,
    kindergarten: txt.nearbyAmenitiesSubTypeKindergarten,
    hospital: txt.nearbyAmenitiesSubTypeHospital,
    clinic: txt.nearbyAmenitiesSubTypeClinic,
    doctors: txt.nearbyAmenitiesSubTypeDoctors,
    pharmacy: txt.nearbyAmenitiesSubTypePharmacy,
    supermarket: txt.nearbyAmenitiesSubTypeSupermarket,
    convenience: txt.nearbyAmenitiesSubTypeConvenience,
    grocery: txt.nearbyAmenitiesSubTypeGrocery,
    park: txt.nearbyAmenitiesSubTypePark,
    playground: txt.nearbyAmenitiesSubTypePlayground,
    bus_stop: txt.nearbyAmenitiesSubTypeBusStop,
    bus_station: txt.nearbyAmenitiesSubTypeBusStation,
    station: txt.nearbyAmenitiesSubTypeStation,
    halt: txt.nearbyAmenitiesSubTypeHalt,
    stop_position: txt.nearbyAmenitiesSubTypeStop,
  }
  return subTypeLabels[place.subType] ?? txt.nearbyAmenitiesUnnamed
}

const categorySummary = (
  category: NearbyCategoryResult,
  lang: Lang,
  locale: string,
): string => {
  const txt = uiText[lang]
  if (category.count === 0) return txt.nearbyAmenitiesNoneInRadius
  const nearest = category.places[0]
  const nearestDistance = nearest
    ? formatDistanceM(nearest.distanceM, locale)
    : "—"
  const countLabel =
    category.count === 1
      ? txt.nearbyAmenitiesCountSingular
      : txt.nearbyAmenitiesCountPlural.replace("{count}", String(category.count))
  return txt.nearbyAmenitiesCategorySummary
    .replace("{countLabel}", countLabel)
    .replace("{distance}", nearestDistance)
}

export default function NearbyAmenitiesCard({
  data,
  loading,
  hasCoordinates,
  lang,
  locale,
  compact = false,
}: Props) {
  const txt = uiText[lang]
  const [expandedId, setExpandedId] = useState<PoiCategoryId | null>(null)

  const radiusKm = useMemo(() => {
    if (!data) return "1"
    return (data.radiusM / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })
  }, [data, locale])

  const titleClass = compact ? "text-sm font-semibold text-foreground" : "text-lg font-semibold text-foreground"

  if (!hasCoordinates) {
    return (
      <Card className="border-slate-200/90 shadow-card">
        <h2 className={titleClass}>{txt.nearbyAmenitiesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{txt.nearbyAmenitiesNoGeo}</p>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="border-slate-200/90 shadow-card">
        <h2 className={titleClass}>{txt.nearbyAmenitiesTitle}</h2>
        <p className="mt-1 text-xs text-muted">
          {txt.nearbyAmenitiesSubtitle.replace("{radius}", radiusKm)}
        </p>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </Card>
    )
  }

  if (!data) return null

  const hasAnyPlaces = data.categories.some((category) => category.count > 0)

  return (
    <Card className="border-slate-200/90 shadow-card">
      <h2 className={titleClass}>{txt.nearbyAmenitiesTitle}</h2>
      <p className="mt-1 text-xs text-muted">
        {txt.nearbyAmenitiesSubtitle.replace("{radius}", radiusKm)}
      </p>

      {data.unavailable ? (
        <p className="mt-3 text-sm text-muted">{txt.nearbyAmenitiesUnavailable}</p>
      ) : null}

      {!data.unavailable && !hasAnyPlaces ? (
        <p className="mt-3 text-sm text-muted">{txt.nearbyAmenitiesEmpty}</p>
      ) : null}

      {!data.unavailable ? (
      <ul className="mt-4 space-y-2">
        {data.categories.map((category) => {
          const isExpanded = expandedId === category.id
          const canExpand = category.places.length > 0
          return (
            <li
              key={category.id}
              className="rounded-xl border border-slate-200/80 bg-surface/60 dark:border-slate-700/70"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                onClick={() => {
                  if (!canExpand) return
                  setExpandedId(isExpanded ? null : category.id)
                }}
                aria-expanded={canExpand ? isExpanded : undefined}
                disabled={!canExpand}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {categoryLabel(lang, category.id)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {categorySummary(category, lang, locale)}
                  </p>
                </div>
                {canExpand ? (
                  <span className="shrink-0 text-xs font-medium text-accent">
                    {isExpanded ? txt.nearbyAmenitiesHideDetail : txt.nearbyAmenitiesShowDetail}
                  </span>
                ) : null}
              </button>
              {isExpanded ? (
                <ul className="border-t border-slate-200/80 px-3 py-2 dark:border-slate-700/70">
                  {category.places.map((place, index) => (
                    <li
                      key={`${category.id}-${place.lat}-${place.lng}-${index}`}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    >
                      <span className="text-foreground">{placeDisplayName(place, lang)}</span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {formatDistanceM(place.distanceM, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
      ) : null}

      <p className="mt-4 text-xs text-muted">{txt.nearbyAmenitiesAttribution}</p>
    </Card>
  )
}
