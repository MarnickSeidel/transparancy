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
  /** Hide the default listing title (e.g. when parent supplies a heading). */
  hideTitle?: boolean
  /** Zone dossiers: barrio copy, hide empty categories, lead summary. */
  variant?: "listing" | "zone"
}

const categoryLabel = (lang: Lang, id: PoiCategoryId): string => {
  const txt = uiText[lang]
  const labels: Record<PoiCategoryId, string> = {
    education: txt.nearbyAmenitiesCategoryEducation,
    health: txt.nearbyAmenitiesCategoryHealth,
    food: txt.nearbyAmenitiesCategoryFood,
    groceries: txt.nearbyAmenitiesCategoryGroceries,
    sports: txt.nearbyAmenitiesCategorySports,
    parks: txt.nearbyAmenitiesCategoryParks,
    services: txt.nearbyAmenitiesCategoryServices,
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
    university: txt.nearbyAmenitiesSubTypeUniversity,
    college: txt.nearbyAmenitiesSubTypeCollege,
    hospital: txt.nearbyAmenitiesSubTypeHospital,
    clinic: txt.nearbyAmenitiesSubTypeClinic,
    doctors: txt.nearbyAmenitiesSubTypeDoctors,
    pharmacy: txt.nearbyAmenitiesSubTypePharmacy,
    restaurant: txt.nearbyAmenitiesSubTypeRestaurant,
    cafe: txt.nearbyAmenitiesSubTypeCafe,
    fast_food: txt.nearbyAmenitiesSubTypeFastFood,
    bar: txt.nearbyAmenitiesSubTypeBar,
    supermarket: txt.nearbyAmenitiesSubTypeSupermarket,
    convenience: txt.nearbyAmenitiesSubTypeConvenience,
    grocery: txt.nearbyAmenitiesSubTypeGrocery,
    mall: txt.nearbyAmenitiesSubTypeMall,
    clothes: txt.nearbyAmenitiesSubTypeClothes,
    bakery: txt.nearbyAmenitiesSubTypeBakery,
    marketplace: txt.nearbyAmenitiesSubTypeMarketplace,
    fitness_centre: txt.nearbyAmenitiesSubTypeFitnessCentre,
    sports_centre: txt.nearbyAmenitiesSubTypeSportsCentre,
    swimming_pool: txt.nearbyAmenitiesSubTypeSwimmingPool,
    pitch: txt.nearbyAmenitiesSubTypePitch,
    park: txt.nearbyAmenitiesSubTypePark,
    playground: txt.nearbyAmenitiesSubTypePlayground,
    bank: txt.nearbyAmenitiesSubTypeBank,
    atm: txt.nearbyAmenitiesSubTypeAtm,
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

const joinLeadItems = (items: string[], lang: Lang): string => {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]!
  const joiner = lang === "es" ? " y " : " and "
  if (items.length === 2) return `${items[0]}${joiner}${items[1]}`
  return `${items.slice(0, -1).join(", ")}${joiner}${items[items.length - 1]}`
}

export default function NearbyAmenitiesCard({
  data,
  loading,
  hasCoordinates,
  lang,
  locale,
  compact = false,
  hideTitle = false,
  variant = "listing",
}: Props) {
  const txt = uiText[lang]
  const isZone = variant === "zone"
  const [expandedId, setExpandedId] = useState<PoiCategoryId | null>(null)

  const radiusKm = useMemo(() => {
    if (!data) return isZone ? "2" : "1"
    return (data.radiusM / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })
  }, [data, locale, isZone])

  const title = isZone ? txt.nearbyAmenitiesZoneTitle : txt.nearbyAmenitiesTitle
  const subtitle = (
    isZone ? txt.nearbyAmenitiesZoneSubtitle : txt.nearbyAmenitiesSubtitle
  ).replace("{radius}", radiusKm)
  const noGeo = isZone ? txt.nearbyAmenitiesZoneNoGeo : txt.nearbyAmenitiesNoGeo

  const titleClass = compact
    ? "text-sm font-semibold text-foreground"
    : "text-lg font-semibold text-foreground"

  if (!hasCoordinates) {
    return (
      <Card className="border-border-subtle shadow-card">
        {hideTitle ? null : <h2 className={titleClass}>{title}</h2>}
        <p className={`text-sm text-muted ${hideTitle ? "" : "mt-2"}`}>{noGeo}</p>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="border-border-subtle shadow-card">
        {hideTitle ? null : <h2 className={titleClass}>{title}</h2>}
        <p className={`text-xs text-muted ${hideTitle ? "" : "mt-1"}`}>{subtitle}</p>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </Card>
    )
  }

  if (!data) return null

  const presentCategories = data.categories.filter((category) => category.count > 0)
  const displayCategories = isZone ? presentCategories : data.categories
  const hasAnyPlaces = presentCategories.length > 0

  const zoneLead =
    isZone && hasAnyPlaces && !data.unavailable
      ? txt.nearbyAmenitiesZoneLead.replace(
          "{summary}",
          joinLeadItems(
            presentCategories.slice(0, 4).map((category) => {
              const nearest = category.places[0]
              const distance = nearest
                ? formatDistanceM(nearest.distanceM, locale)
                : "—"
              return txt.nearbyAmenitiesZoneLeadItem
                .replace("{category}", categoryLabel(lang, category.id).toLowerCase())
                .replace("{distance}", distance)
            }),
            lang,
          ),
        )
      : null

  return (
    <Card className="border-border-subtle shadow-card">
      {hideTitle ? null : <h2 className={titleClass}>{title}</h2>}
      {zoneLead ? (
        <p className={`text-sm text-foreground ${hideTitle ? "" : "mt-2"}`}>{zoneLead}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted">{subtitle}</p>

      {data.unavailable ? (
        <p className="mt-3 text-sm text-muted">{txt.nearbyAmenitiesUnavailable}</p>
      ) : null}

      {!data.unavailable && !hasAnyPlaces ? (
        <p className="mt-3 text-sm text-muted">{txt.nearbyAmenitiesEmpty}</p>
      ) : null}

      {!data.unavailable && displayCategories.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {displayCategories.map((category) => {
            const isExpanded = expandedId === category.id
            const canExpand = category.places.length > 0
            return (
              <li
                key={category.id}
                className="rounded-xl border border-border-subtle bg-surface/60"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left link-focus disabled:cursor-default disabled:opacity-70"
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
                      {isExpanded
                        ? txt.nearbyAmenitiesHideDetail
                        : txt.nearbyAmenitiesShowDetail}
                    </span>
                  ) : null}
                </button>
                {isExpanded ? (
                  <ul className="border-t border-border-subtle px-3 py-2">
                    {category.places.map((place, index) => (
                      <li
                        key={`${category.id}-${place.lat}-${place.lng}-${index}`}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm"
                      >
                        <span className="text-foreground">
                          {placeDisplayName(place, lang)}
                        </span>
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
