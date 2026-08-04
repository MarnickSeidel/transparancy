"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { listingPath } from "@/lib/locale"
import {
  isValidColombiaCoordinate,
  normalizeListingCoordinates,
} from "@/lib/nearbyAmenities"

export type OpportunityMapPoint = {
  id: string
  title: string
  neighborhood: string | null
  priceCop: string
  discountVsRefPct: number | null
  dealScore: number | null
  latitude?: number | null
  longitude?: number | null
}

type Props = {
  items: OpportunityMapPoint[]
  lang: "es" | "en"
  locale: string
  /** Remount map only when city changes — avoid Leaflet teardown races on filter edits. */
  mapKey: string
  cityCenter?: [number, number]
  loading?: boolean
  emptyLabel: string
  noCoordsLabel: string
  discountLabel: string
  dealScoreLabel: string
  openListingLabel: string
}

const FALLBACK_CENTER: [number, number] = [4.8133, -75.6961]

const fixLeafletIcons = () => {
  const proto = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string
  }
  delete proto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  })
}

const safeMapMove = (map: L.Map, run: () => void) => {
  const container = map.getContainer()
  if (!container?.isConnected) return
  try {
    map.invalidateSize({ animate: false })
    run()
  } catch {
    // Leaflet can throw _leaflet_pos while the pane is tearing down.
  }
}

const FitMarkers = ({
  points,
  fallbackCenter,
  loading,
}: {
  points: Array<{ lat: number; lng: number }>
  fallbackCenter: [number, number]
  loading: boolean
}) => {
  const map = useMap()
  const pointsKey = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|")

  useEffect(() => {
    if (loading) return

    const frame = window.requestAnimationFrame(() => {
      safeMapMove(map, () => {
        if (points.length === 0) {
          map.setView(fallbackCenter, 12, { animate: false })
          return
        }
        if (points.length === 1) {
          map.setView([points[0].lat, points[0].lng], 14, { animate: false })
          return
        }
        const bounds = L.latLngBounds(
          points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        )
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false })
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [map, pointsKey, fallbackCenter, loading, points])

  return null
}

const fmtCop = (v: number | null | undefined, locale: string) => {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

export default function OpportunitiesMap({
  items,
  lang,
  locale,
  mapKey,
  cityCenter,
  loading = false,
  emptyLabel,
  noCoordsLabel,
  discountLabel,
  dealScoreLabel,
  openListingLabel,
}: Props) {
  useEffect(() => {
    fixLeafletIcons()
  }, [])

  const fallbackCenter = cityCenter ?? FALLBACK_CENTER

  const markers = useMemo(() => {
    return items.flatMap((item) => {
      if (item.latitude == null || item.longitude == null) return []
      const { lat, lng } = normalizeListingCoordinates(item.latitude, item.longitude)
      if (!isValidColombiaCoordinate(lat, lng)) return []
      return [{ ...item, lat, lng }]
    })
  }, [items])

  const statusMessage =
    !loading && items.length === 0
      ? emptyLabel
      : !loading && markers.length === 0
        ? noCoordsLabel
        : null

  return (
    <div className="relative h-[28rem] w-full md:h-[32rem]">
      <MapContainer
        key={mapKey}
        center={fallbackCenter}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        aria-label={lang === "es" ? "Mapa de oportunidades" : "Opportunities map"}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMarkers
          points={markers.map((m) => ({ lat: m.lat, lng: m.lng }))}
          fallbackCenter={fallbackCenter}
          loading={loading}
        />
        {!loading
          ? markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]}>
                <Popup>
                  <div className="min-w-[12rem] space-y-1 text-sm">
                    <p className="font-semibold text-slate-900">{m.title}</p>
                    {m.neighborhood ? (
                      <p className="text-xs text-slate-600">{m.neighborhood}</p>
                    ) : null}
                    <p className="tabular-nums text-slate-800">
                      {fmtCop(Number(m.priceCop), locale)}
                    </p>
                    <p className="text-xs text-slate-700">
                      {discountLabel}:{" "}
                      {m.discountVsRefPct == null
                        ? "—"
                        : `${m.discountVsRefPct.toFixed(1)}%`}
                    </p>
                    <p className="text-xs text-slate-700">
                      {dealScoreLabel}: {m.dealScore?.toFixed(1) ?? "—"}
                    </p>
                    <a
                      href={listingPath(lang, m.id)}
                      className="inline-block pt-1 font-medium text-teal-700 underline"
                    >
                      {openListingLabel}
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}
      </MapContainer>

      {loading ? (
        <div
          className="absolute inset-0 z-[500] flex items-center justify-center bg-elevated/70"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-surface" />
        </div>
      ) : null}

      {statusMessage ? (
        <div className="absolute inset-x-0 bottom-0 z-[500] border-t border-border-subtle bg-elevated/95 px-4 py-2 text-center text-xs text-muted">
          {statusMessage}
        </div>
      ) : null}
    </div>
  )
}
