"use client"

import { useEffect, useState } from "react"

import {
  DEFAULT_NEARBY_RADIUS_M,
  emptyNearbyAmenitiesResult,
  type NearbyAmenitiesResult,
} from "@/lib/nearbyAmenities"

type Options = {
  enabled?: boolean
  radiusM?: number
}

export const useNearbyAmenities = (
  lat: number | null | undefined,
  lng: number | null | undefined,
  options: Options = {},
) => {
  const enabled = options.enabled !== false
  const radiusM = options.radiusM ?? DEFAULT_NEARBY_RADIUS_M
  const [data, setData] = useState<NearbyAmenitiesResult | null>(null)
  const [loading, setLoading] = useState(false)

  const hasCoordinates =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)

  useEffect(() => {
    if (!enabled || !hasCoordinates) {
      setData(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setData(null)
    setLoading(true)

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      radiusM: String(radiusM),
    })

    void fetch(`/api/nearby-amenities?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as NearbyAmenitiesResult
      })
      .then((result) => {
        if (controller.signal.aborted) return
        if (result) {
          setData(result)
          return
        }
        setData(emptyNearbyAmenitiesResult(lat!, lng!, radiusM, true))
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setData(emptyNearbyAmenitiesResult(lat!, lng!, radiusM, true))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [enabled, hasCoordinates, lat, lng, radiusM])

  const showLoading = enabled && hasCoordinates && (loading || !data)

  return { data, loading: showLoading, hasCoordinates }
}
