"use client"

import NearbyAmenitiesCard from "@/app/components/NearbyAmenitiesCard"
import type { Lang } from "@/lib/i18n"
import type { NearbyAmenitiesResult } from "@/lib/nearbyAmenities"
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
  variant?: "listing" | "zone"
  /** Server-prefetched result — shown immediately; skips client fetch when present. */
  initialData?: NearbyAmenitiesResult | null
  /** When set, skips the internal fetch (shared with listing narrative). */
  prefetched?: {
    data: NearbyAmenitiesResult | null
    loading: boolean
    hasCoordinates: boolean
  }
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
  variant = "listing",
  initialData = null,
  prefetched,
}: Props) {
  const fetched = useNearbyAmenities(latitude, longitude, {
    enabled: enabled && !prefetched,
    radiusM,
    initialData: prefetched ? null : initialData,
  })

  const data = prefetched?.data ?? fetched.data
  const loading = prefetched?.loading ?? fetched.loading
  const hasCoordinates = prefetched?.hasCoordinates ?? fetched.hasCoordinates

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
        variant={variant}
      />
    </div>
  )
}
