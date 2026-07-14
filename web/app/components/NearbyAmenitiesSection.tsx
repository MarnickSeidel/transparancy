"use client"

import NearbyAmenitiesCard from "@/app/components/NearbyAmenitiesCard"
import type { Lang } from "@/lib/i18n"
import { useNearbyAmenities } from "@/lib/useNearbyAmenities"

type Props = {
  latitude: number | null | undefined
  longitude: number | null | undefined
  lang: Lang
  locale: string
  enabled?: boolean
  radiusM?: number
  compact?: boolean
  className?: string
  hideTitle?: boolean
}

export default function NearbyAmenitiesSection({
  latitude,
  longitude,
  lang,
  locale,
  enabled = true,
  radiusM,
  compact = false,
  className = "",
  hideTitle = false,
}: Props) {
  const { data, loading, hasCoordinates } = useNearbyAmenities(latitude, longitude, {
    enabled,
    radiusM,
  })

  if (!enabled) return null

  return (
    <div className={className}>
      <NearbyAmenitiesCard
        data={data}
        loading={loading}
        hasCoordinates={hasCoordinates}
        lang={lang}
        locale={locale}
        compact={compact}
        hideTitle={hideTitle}
      />
    </div>
  )
}
