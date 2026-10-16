import { groupConjuntoNames } from "@/lib/conjuntos"
import { pickBestNeighborhoodLabel } from "@/lib/filterNeighborhoods"
import { priorityCities } from "@/lib/i18n"
import { catalogNeighborhoodOptionsForCity } from "@/lib/neighborhoodResolver"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"

const DEPARTMENT_CACHE_MS = 60 * 60 * 1000
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

  let neighborhoods: string[]
  if (city && city !== "all") {
    const catalogOptions = catalogNeighborhoodOptionsForCity(city, rawNeighborhoodLabels)
    if (catalogOptions && catalogOptions.length > 0) {
      neighborhoods = catalogOptions
    } else {
      neighborhoods = Array.from(neighborhoodBuckets.values())
        .map((b) => pickBestNeighborhoodLabel(b.labels))
        .filter((n): n is string => n != null)
        .sort((a, b) => a.localeCompare(b))
    }
  } else {
    neighborhoods = Array.from(neighborhoodBuckets.values())
      .map((b) => pickBestNeighborhoodLabel(b.labels))
      .filter((n): n is string => n != null)
      .sort((a, b) => a.localeCompare(b))
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
    estratos,
    propertyTypes,
    operationTypes,
    conjuntos,
  }
}
