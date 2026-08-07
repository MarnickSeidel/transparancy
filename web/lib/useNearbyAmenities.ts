"use client"

import { useEffect, useRef, useState } from "react"

import {
  DEFAULT_NEARBY_RADIUS_M,
  emptyNearbyAmenitiesResult,
  type NearbyAmenitiesResult,
} from "@/lib/nearbyAmenities"

type Options = {
  enabled?: boolean
  radiusM?: number
  /** SSR / parent prefetch — shown immediately; client refetch only if missing. */
  initialData?: NearbyAmenitiesResult | null
}

export const useNearbyAmenities = (
  lat: number | null | undefined,
  lng: number | null | undefined,
  options: Options = {},
) => {
  const enabled = options.enabled !== false
  const radiusM = options.radiusM ?? DEFAULT_NEARBY_RADIUS_M
  const initialData = options.initialData ?? null

  const [data, setData] = useState<NearbyAmenitiesResult | null>(initialData)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

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

    if (initialData && !initialData.unavailable) {
      setData(initialData)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const requestId = ++requestIdRef.current
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
        if (requestId !== requestIdRef.current) return
        if (result) {
          setData(result)
          return
        }
        setData(emptyNearbyAmenitiesResult(lat!, lng!, radiusM, true))
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return
        if (controller.signal.aborted) return
        if (err instanceof DOMException && err.name === "AbortError") return
        if (err instanceof Error && err.name === "AbortError") return
        setData(emptyNearbyAmenitiesResult(lat!, lng!, radiusM, true))
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [enabled, hasCoordinates, lat, lng, radiusM, initialData])

  // Skeleton only while waiting and we have nothing useful to show yet.
  const showLoading = enabled && hasCoordinates && loading && !data

  return { data, loading: showLoading, hasCoordinates }
}
