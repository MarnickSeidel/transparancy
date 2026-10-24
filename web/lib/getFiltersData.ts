import { groupConjuntoNames } from "@/lib/conjuntos"
import { pickBestNeighborhoodLabel } from "@/lib/filterNeighborhoods"
import { priorityCities } from "@/lib/i18n"
import {
  catalogCanonicalForLabel,
  catalogNeighborhoodOptionsForCity,
} from "@/lib/neighborhoodResolver"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"

const DEPARTMENT_CACHE_MS = 60 * 60 * 1000
/** Analyze-url can store one-off listings from towns the scraper does not cover. */
export const MIN_CITY_ACTIVE_LISTINGS = 50
/** Closed list shows portal barrios with at least this many listings. Search includes one-offs. */
const EXTRA_NEIGHBORHOOD_MIN_LISTINGS = 5

function neighborhoodLabels(
  city: string | null,
  buckets: Map<string, { labels: string[]; count: number }>,
  minCount: number,
): string[] {
  const cityKey = city && city !== "all" ? normalizeNeighborhoodKey(city) : ""
  const labels: string[] = []
  for (const bucket of Array.from(buckets.values())) {
    if (bucket.count < minCount) continue
    const label = pickBestNeighborhoodLabel(bucket.labels)
    if (!label) continue
    const key = normalizeNeighborhoodKey(label)
    if (!key || (cityKey && key === cityKey)) continue
    if (city && city !== "all" && catalogCanonicalForLabel(city, label)) continue
    labels.push(label)
  }
  return labels.sort((a, b) => a.localeCompare(b, "es"))
}

function mergeNeighborhoodLabels(catalog: string[], extras: string[]): string[] {
  const seen = new Set(catalog.map((name) => normalizeNeighborhoodKey(name)))
  const merged = [...catalog]
  for (const label of extras) {
    const key = normalizeNeighborhoodKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(label)
  }
  return merged.sort((a, b) => a.localeCompare(b, "es"))
}
let departmentNameCache: { at: number; names: Set<string> } | null = null

/** Department names barely change, and grouping them scans every active listing. */
async function activeDepartmentNames(): Promise<Set<string>> {
  const now = Date.now()
  if (departmentNameCache && now - departmentNameCache.at < DEPARTMENT_CACHE_MS) {
    return departmentNameCache.names
  }
  const rows = await prisma.listing.groupBy({
    by: ["department"],
    where: { isActive: true },
    orderBy: { department: "asc" },
  })
  const names = new Set(
    rows
      .map((r) => r.department?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name)),
  )
  departmentNameCache = { at: now, names }
  return names
}

export type FiltersData = {
  cities: string[]
  neighborhoods: string[]
  /** Every usable barrio label, including ones with a single listing. */
  neighborhoodSearch: string[]
  estratos: number[]
  propertyTypes: string[]
  operationTypes: string[]
  conjuntos: string[]
}

export async function getFiltersData(city: string | null): Promise<FiltersData> {
  const baseWhere =
    city && city !== "all" ? { isActive: true, city } : { isActive: true }

  const [
    cityRows,
    departmentNames,
    neighborhoodRows,
    estratoRows,
    propertyTypeRows,
    operationTypeRows,
    conjuntoRows,
  ] = await Promise.all([
    prisma.listing.groupBy({
      by: ["city"],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: { city: "asc" },
    }),
    activeDepartmentNames(),
    prisma.listing.groupBy({
      by: ["neighborhood"],
      where: { ...baseWhere, neighborhood: { not: null } },
      _count: { neighborhood: true },
      orderBy: { neighborhood: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["estrato"],
      where: { ...baseWhere, estrato: { not: null } },
      orderBy: { estrato: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["propertyType"],
      where: { ...baseWhere, propertyType: { not: null } },
      orderBy: { propertyType: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["operationType"],
      where: { ...baseWhere, operationType: { not: null } },
      orderBy: { operationType: "asc" },
    }),
    city && city !== "all"
      ? prisma.listing
          .groupBy({
            by: ["conjunto"],
            where: { ...baseWhere, conjunto: { not: null } },
            _count: { _all: true },
          })
          .catch((conjuntoErr: unknown) => {
            console.error("filters: conjunto groupBy failed (non-fatal)", conjuntoErr)
            return []
          })
      : Promise.resolve([]),
  ])

  const conjuntoInputs: { name: string; count: number }[] = []
  for (const row of conjuntoRows) {
    const name = row.conjunto?.trim()
    if (!name) continue
    conjuntoInputs.push({ name, count: row._count._all })
  }
  const conjuntos =
    conjuntoInputs.length > 0
      ? groupConjuntoNames(conjuntoInputs).map((g) => g.canonical)
      : []

  const detectedCities = cityRows
    .filter((r) => r._count._all >= MIN_CITY_ACTIVE_LISTINGS)
    .map((r) => r.city)
    .filter(
      (c): c is string =>
        c != null &&
        c.trim().length > 0 &&
        !departmentNames.has(c.trim().toLowerCase()),
    )
  const rank = new Map(priorityCities.map((name, idx) => [name.toLowerCase(), idx]))
  const cities = [...detectedCities].sort((a, b) => {
    const ra = rank.get(a.trim().toLowerCase())
    const rb = rank.get(b.trim().toLowerCase())
    if (ra != null && rb != null) return ra - rb
    if (ra != null) return -1
    if (rb != null) return 1
    return a.localeCompare(b)
  })

  const neighborhoodBuckets = new Map<string, { labels: string[]; count: number }>()
  const rawNeighborhoodLabels: string[] = []
  for (const row of neighborhoodRows) {
    const raw = row.neighborhood?.trim()
    if (!raw) continue
    rawNeighborhoodLabels.push(raw)
    const key = normalizeNeighborhoodKey(raw)
    if (!key) continue
    const prev = neighborhoodBuckets.get(key)
    const count = row._count?.neighborhood ?? 1
    if (!prev) {
      neighborhoodBuckets.set(key, { labels: [raw], count })
      continue
    }
    prev.labels.push(raw)
    prev.count += count
  }

  const allLabels = neighborhoodLabels(city, neighborhoodBuckets, 1)
  let neighborhoods: string[]
  let neighborhoodSearch: string[]
  if (city && city !== "all") {
    const catalogOptions = catalogNeighborhoodOptionsForCity(city, rawNeighborhoodLabels)
    if (catalogOptions && catalogOptions.length > 0) {
      const frequent = neighborhoodLabels(
        city,
        neighborhoodBuckets,
        EXTRA_NEIGHBORHOOD_MIN_LISTINGS,
      )
      neighborhoods = mergeNeighborhoodLabels(catalogOptions, frequent)
      neighborhoodSearch = mergeNeighborhoodLabels(catalogOptions, allLabels)
    } else {
      neighborhoods = allLabels
      neighborhoodSearch = allLabels
    }
  } else {
    neighborhoods = allLabels
    neighborhoodSearch = allLabels
  }

  const estratos = estratoRows
    .map((r) => r.estrato)
    .filter((e): e is number => e != null)

  const propertyTypes = propertyTypeRows
    .map((r) => r.propertyType)
    .filter((t): t is string => t != null && t.trim().length > 0)

  const operationTypes = operationTypeRows
    .map((r) => r.operationType)
    .filter((t): t is string => t != null && t.trim().length > 0)

  return {
    cities,
    neighborhoods,
    neighborhoodSearch,
    estratos,
    propertyTypes,
    operationTypes,
    conjuntos,
  }
}
