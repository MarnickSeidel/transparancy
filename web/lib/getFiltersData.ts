import { pickBestNeighborhoodLabel } from "@/lib/filterNeighborhoods"
import { priorityCities } from "@/lib/i18n"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"

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
    departmentRows,
    neighborhoodRows,
    estratoRows,
    propertyTypeRows,
    operationTypeRows,
  ] = await Promise.all([
    prisma.listing.groupBy({
      by: ["city"],
      where: { isActive: true },
      orderBy: { city: "asc" },
    }),
    prisma.listing.groupBy({
      by: ["department"],
      where: { isActive: true },
      orderBy: { department: "asc" },
    }),
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
  ])

  let conjuntos: string[] = []
  try {
    const conjuntoRows = await prisma.listing.groupBy({
      by: ["conjunto"],
      where: { ...baseWhere, conjunto: { not: null } },
    })
    conjuntos = conjuntoRows
      .map((r) => r.conjunto)
      .filter((c): c is string => c != null && c.trim().length > 0)
      .sort((a, b) => a.localeCompare(b))
  } catch (conjuntoErr) {
    console.error("filters: conjunto groupBy failed (non-fatal)", conjuntoErr)
  }

  const departmentNames = new Set(
    departmentRows.map((r) => r.department?.trim().toLowerCase()).filter(Boolean),
  )
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
  for (const row of neighborhoodRows) {
    const raw = row.neighborhood?.trim()
    if (!raw) continue
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
  const neighborhoods = Array.from(neighborhoodBuckets.values())
    .map((b) => pickBestNeighborhoodLabel(b.labels))
    .filter((n): n is string => n != null)
    .sort((a, b) => a.localeCompare(b))

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
