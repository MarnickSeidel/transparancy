import { haversineMeters } from "@/lib/geoHaversine"

export const DEFAULT_NEARBY_RADIUS_M = 1000
export const MAX_NEARBY_RADIUS_M = 3000
export const MAX_PLACES_PER_CATEGORY = 5

export type OsmTagFilter = { key: string; value: string }

export type PoiCategoryId =
  | "education"
  | "health"
  | "groceries"
  | "parks"
  | "transit"

export type PoiCategoryDef = {
  id: PoiCategoryId
  osmFilters: OsmTagFilter[]
}

export const POI_CATEGORIES: PoiCategoryDef[] = [
  {
    id: "education",
    osmFilters: [
      { key: "amenity", value: "school" },
      { key: "amenity", value: "kindergarten" },
    ],
  },
  {
    id: "health",
    osmFilters: [
      { key: "amenity", value: "hospital" },
      { key: "amenity", value: "clinic" },
      { key: "amenity", value: "doctors" },
      { key: "amenity", value: "pharmacy" },
    ],
  },
  {
    id: "groceries",
    osmFilters: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "convenience" },
      { key: "shop", value: "grocery" },
    ],
  },
  {
    id: "parks",
    osmFilters: [
      { key: "leisure", value: "park" },
      { key: "leisure", value: "playground" },
    ],
  },
  {
    id: "transit",
    osmFilters: [
      { key: "highway", value: "bus_stop" },
      { key: "amenity", value: "bus_station" },
      { key: "railway", value: "station" },
      { key: "railway", value: "halt" },
      { key: "public_transport", value: "stop_position" },
    ],
  },
]

export type NearbyPlace = {
  name: string | null
  distanceM: number
  lat: number
  lng: number
  subType: string
}

export type NearbyCategoryResult = {
  id: PoiCategoryId
  count: number
  places: NearbyPlace[]
}

export type NearbyAmenitiesResult = {
  radiusM: number
  lat: number
  lng: number
  categories: NearbyCategoryResult[]
  source: "openstreetmap"
  fetchedAt: string
  unavailable?: boolean
}

type OverpassElement = {
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
]
const OVERPASS_TIMEOUT_SEC = 55
const FETCH_TIMEOUT_MS = 60000
const OVERPASS_USER_AGENT = "ClaraCasas/1.0 (colombia-real-estate; nearby-amenities)"

const COLOMBIA_LAT_MIN = -4.5
const COLOMBIA_LAT_MAX = 13.5
const COLOMBIA_LNG_MIN = -82
const COLOMBIA_LNG_MAX = -66

export const roundCoordForCache = (value: number): number =>
  Math.round(value * 10000) / 10000

export const isValidColombiaCoordinate = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= COLOMBIA_LAT_MIN &&
  lat <= COLOMBIA_LAT_MAX &&
  lng >= COLOMBIA_LNG_MIN &&
  lng <= COLOMBIA_LNG_MAX

/** Some sources swap lat/lng; Colombia lat is positive ~0–13, lng negative ~−66 to −82. */
export const normalizeListingCoordinates = (
  lat: number,
  lng: number,
): { lat: number; lng: number } => {
  if (
    lat < 0 &&
    lng > 0 &&
    lng <= COLOMBIA_LAT_MAX &&
    lat >= COLOMBIA_LNG_MIN &&
    lat <= COLOMBIA_LNG_MAX
  ) {
    return { lat: lng, lng: lat }
  }
  return { lat, lng }
}

export const formatDistanceM = (distanceM: number, locale: string): string => {
  if (!Number.isFinite(distanceM) || distanceM < 0) return "—"
  if (distanceM < 1000) {
    return `${Math.round(distanceM)} m`
  }
  const km = distanceM / 1000
  return `${km.toLocaleString(locale, { maximumFractionDigits: 1 })} km`
}

const buildOverpassQuery = (lat: number, lng: number, radiusM: number): string => {
  const filters = POI_CATEGORIES.flatMap((category) =>
    category.osmFilters.map(
      (filter) =>
        `  nwr["${filter.key}"="${filter.value}"](around:${radiusM},${lat},${lng});`,
    ),
  )
  return `[out:json][timeout:${OVERPASS_TIMEOUT_SEC}];
(
${filters.join("\n")}
);
out center;`
}

const classifyCategory = (tags: Record<string, string>): PoiCategoryId | null => {
  for (const category of POI_CATEGORIES) {
    for (const filter of category.osmFilters) {
      if (tags[filter.key] === filter.value) {
        return category.id
      }
    }
  }
  return null
}

const resolveSubType = (tags: Record<string, string>): string => {
  if (tags.amenity) return tags.amenity
  if (tags.shop) return tags.shop
  if (tags.leisure) return tags.leisure
  if (tags.highway) return tags.highway
  if (tags.railway) return tags.railway
  if (tags.public_transport) return tags.public_transport
  return "place"
}

const resolveName = (tags: Record<string, string>): string | null => {
  const candidates = [tags.name, tags["name:es"], tags["name:en"], tags.brand]
  for (const value of candidates) {
    if (value?.trim()) return value.trim()
  }
  return null
}

const elementCoordinates = (
  element: OverpassElement,
): { lat: number; lng: number } | null => {
  if (element.lat != null && element.lon != null) {
    return { lat: element.lat, lng: element.lon }
  }
  if (element.center?.lat != null && element.center?.lon != null) {
    return { lat: element.center.lat, lng: element.center.lon }
  }
  return null
}

export const emptyNearbyAmenitiesResult = (
  lat: number,
  lng: number,
  radiusM: number,
  unavailable = false,
): NearbyAmenitiesResult => ({
  radiusM,
  lat,
  lng,
  categories: POI_CATEGORIES.map((category) => ({
    id: category.id,
    count: 0,
    places: [],
  })),
  source: "openstreetmap",
  fetchedAt: new Date().toISOString(),
  unavailable,
})

const requestOverpass = async (query: string): Promise<Response | null> => {
  const body = `data=${encodeURIComponent(query)}`
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": OVERPASS_USER_AGENT,
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
        cache: "no-store",
      })
      if (response.ok) return response
    } catch {
      /* try next mirror */
    } finally {
      clearTimeout(timeout)
    }
  }
  return null
}

export const fetchNearbyAmenities = async (
  latInput: number,
  lngInput: number,
  radiusM: number = DEFAULT_NEARBY_RADIUS_M,
): Promise<NearbyAmenitiesResult> => {
  const { lat, lng } = normalizeListingCoordinates(latInput, lngInput)

  if (!isValidColombiaCoordinate(lat, lng)) {
    return emptyNearbyAmenitiesResult(lat, lng, radiusM, true)
  }

  const query = buildOverpassQuery(lat, lng, radiusM)

  try {
    const response = await requestOverpass(query)
    if (!response) {
      return emptyNearbyAmenitiesResult(lat, lng, radiusM, true)
    }

    const payload = (await response.json()) as { elements?: OverpassElement[] }
    const buckets = new Map<PoiCategoryId, NearbyPlace[]>()

    for (const category of POI_CATEGORIES) {
      buckets.set(category.id, [])
    }

    for (const element of payload.elements ?? []) {
      const tags = element.tags
      if (!tags) continue

      const categoryId = classifyCategory(tags)
      if (!categoryId) continue

      const coords = elementCoordinates(element)
      if (!coords) continue

      const distanceM = haversineMeters(lat, lng, coords.lat, coords.lng)
      if (distanceM > radiusM) continue

      buckets.get(categoryId)?.push({
        name: resolveName(tags),
        distanceM,
        lat: coords.lat,
        lng: coords.lng,
        subType: resolveSubType(tags),
      })
    }

    const categories: NearbyCategoryResult[] = POI_CATEGORIES.map((category) => {
      const sorted = (buckets.get(category.id) ?? []).sort(
        (a, b) => a.distanceM - b.distanceM,
      )
      return {
        id: category.id,
        count: sorted.length,
        places: sorted.slice(0, MAX_PLACES_PER_CATEGORY),
      }
    })

    return {
      radiusM,
      lat,
      lng,
      categories,
      source: "openstreetmap",
      fetchedAt: new Date().toISOString(),
    }
  } catch {
    return emptyNearbyAmenitiesResult(lat, lng, radiusM, true)
  }
}
