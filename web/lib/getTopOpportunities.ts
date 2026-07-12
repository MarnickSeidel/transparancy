import type { Prisma } from "@prisma/client"

import { MIN_ANALYTICS_AREA_M2, percentile } from "@/lib/analytics"
import {
  analyzeDeal,
  buildWhyDeal,
  toDealListingInput,
  type DealListingInput,
  type MetricType,
} from "@/lib/dealEngine"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"

const COMP_POOL_SIZE = 120
const MAX_CANDIDATES = 72
const DEFAULT_LIMIT = 10

const listingSelect = {
  id: true,
  externalId: true,
  title: true,
  city: true,
  neighborhood: true,
  zoneName: true,
  propertyType: true,
  constructionState: true,
  estrato: true,
  operationType: true,
  areaM2: true,
  areaBuiltM2: true,
  areaPrivateM2: true,
  areaTerrainM2: true,
  areaTerraceM2: true,
  priceCop: true,
  pricePerM2: true,
  pricePerM2Built: true,
  pricePerM2Private: true,
  pricePerM2Terrain: true,
  priceAdminIncluded: true,
  adminFeeCop: true,
  bedrooms: true,
  bathrooms: true,
  latitude: true,
  longitude: true,
  sourceUpdatedAt: true,
  firstSeenAt: true,
  dataCompletenessScore: true,
  acceptsBarter: true,
  terraceHeavyFlag: true,
  areaMismatchFlag: true,
  isProject: true,
  paidQuota: true,
  highlight: true,
  description: true,
  dealScore: true,
  url: true,
  imageUrl: true,
} satisfies Prisma.ListingSelect

export type OpportunityQuery = {
  city?: string | null
  propertyType?: string | null
  neighborhood?: string | null
  excludeNeighborhoods?: string[]
  excludeUnknownNeighborhoods?: boolean
  hideLowConfidence?: boolean
  excludeBarter?: boolean
  excludeProjects?: boolean
  minDiscountPct?: number
  maxPriceCop?: bigint | null
  limit?: number
}

export type OpportunityRow = {
  id: string
  title: string
  city: string
  neighborhood: string | null
  zoneName: string | null
  propertyType: string | null
  priceCop: string
  areaM2: number
  areaPrivateM2: number | null
  pricePerM2: number | null
  metricType: MetricType
  refAvgUsed: number | null
  compSampleSize: number
  compMethod: string
  dealScore: number | null
  scoreBreakdown: unknown
  whyDeal: unknown
  confidence: "high" | "medium" | "low"
  confidenceReasons: string[]
  discountVsRefPct: number | null
  priceDropPct: number | null
  domDays: number | null
  priceTimeline: Array<{ recordedAt: string; priceCop: string }>
  acceptsBarter: boolean
  terraceHeavy: boolean
  isProject: boolean
  url: string
  imageUrl: string | null
  sourceUpdatedAt: string | null
}

function parseExcludeNeighborhoods(values: string[]): Set<string> {
  const set = new Set<string>()
  for (const raw of values) {
    for (const part of raw.split(",")) {
      const t = part.trim()
      if (t) set.add(normalizeNeighborhoodKey(t))
    }
  }
  return set
}

function neighborhoodPassesFilters(
  value: string | null,
  selectedNeighborhoodKey: string | null,
  excludedNeighborhoodKeys: Set<string>,
  excludeUnknownNeighborhoods: boolean,
): boolean {
  const raw = value?.trim() ?? ""
  const key = raw ? normalizeNeighborhoodKey(raw) : ""
  if (selectedNeighborhoodKey && key !== selectedNeighborhoodKey) return false
  if (excludedNeighborhoodKeys.size > 0 && key && excludedNeighborhoodKeys.has(key)) {
    return false
  }
  if (excludeUnknownNeighborhoods) {
    if (!raw) return false
    if (key === "desconocido" || key === "unknown") return false
  }
  return true
}

function minBuiltPpm2ForHouse(pool: DealListingInput[]): number {
  const builtHousePpm2 = pool
    .filter((l) => (l.propertyType ?? "").toLowerCase().includes("casa"))
    .map((l) => l.pricePerM2Built)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  const p15 = percentile(builtHousePpm2, 0.15)
  return p15 != null ? Math.max(900_000, p15 * 0.75) : 900_000
}

/** Uses precomputed deal_score index — analyzes at most ~200 rows, not 5k. */
export async function getTopOpportunities(query: OpportunityQuery): Promise<OpportunityRow[]> {
  const {
    city,
    propertyType,
    neighborhood,
    excludeNeighborhoods = [],
    excludeUnknownNeighborhoods = false,
    hideLowConfidence = true,
    excludeBarter = false,
    excludeProjects = false,
    minDiscountPct = 0,
    maxPriceCop = null,
    limit = DEFAULT_LIMIT,
  } = query

  const selectedNeighborhoodKey =
    neighborhood && neighborhood.trim() ? normalizeNeighborhoodKey(neighborhood.trim()) : null
  const excludedNeighborhoodKeys = parseExcludeNeighborhoods(excludeNeighborhoods)

  const andFilters: Prisma.ListingWhereInput[] = [
    {
      isActive: true,
      pricePerM2: { not: null },
      areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      operationType: { contains: "venta", mode: "insensitive" },
      dealScore: { not: null },
    },
  ]

  if (maxPriceCop != null) andFilters.push({ priceCop: { lte: maxPriceCop } })
  if (city && city !== "all") andFilters.push({ city })
  if (propertyType && propertyType.trim()) andFilters.push({ propertyType: propertyType.trim() })
  if (excludeBarter) andFilters.push({ acceptsBarter: false })
  if (excludeProjects) andFilters.push({ isProject: false })

  const rows = await prisma.listing.findMany({
    where: { AND: andFilters },
    orderBy: [{ dealScore: "desc" }, { dateScraped: "desc" }],
    take: COMP_POOL_SIZE,
    select: listingSelect,
  })

  const filteredRows = rows
    .filter((r) =>
      neighborhoodPassesFilters(
        r.neighborhood,
        selectedNeighborhoodKey,
        excludedNeighborhoodKeys,
        excludeUnknownNeighborhoods,
      ),
    )
    .slice(0, Math.min(Math.max(limit * 8, 24), MAX_CANDIDATES))

  if (filteredRows.length === 0) return []

  const pool = rows.map((r) => toDealListingInput(r))
  const houseFloor = minBuiltPpm2ForHouse(pool)

  const candidateIds = filteredRows.map((r) => r.id)
  const priceEventsRaw = await prisma.listingPriceEvent.findMany({
    where: {
      listingId: { in: candidateIds },
      recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
    },
    orderBy: { recordedAt: "desc" },
  })

  const priceEventsByListing = new Map<string, { priceCop: bigint; recordedAt: Date }[]>()
  for (const ev of priceEventsRaw) {
    const arr = priceEventsByListing.get(ev.listingId) ?? []
    arr.push({ priceCop: ev.priceCop, recordedAt: ev.recordedAt })
    priceEventsByListing.set(ev.listingId, arr)
  }

  const sortedCandidates = [...filteredRows].sort(
    (a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1),
  )
  const results: OpportunityRow[] = []

  for (const row of sortedCandidates) {
    if (results.length >= limit) break

    const subject = toDealListingInput(row)
    const analysis = analyzeDeal(subject, pool, {
      priceEvents: priceEventsByListing.get(row.id),
      minBuiltPpm2ForHouse: houseFloor,
      requirePositiveDiscount: true,
    })
    if (analysis.excluded) continue
    if (
      analysis.discountVsRefPct == null ||
      analysis.discountVsRefPct < minDiscountPct
    ) {
      continue
    }
    if (hideLowConfidence && analysis.confidence === "low") continue

    const whyDeal = buildWhyDeal(analysis, subject)
    const listingEvents = priceEventsByListing.get(row.id) ?? []
    const priceTimeline = listingEvents.map((e) => ({
      recordedAt: e.recordedAt.toISOString(),
      priceCop: e.priceCop.toString(),
    }))
    const currentPriceStr = row.priceCop.toString()
    if (
      priceTimeline.length === 0 ||
      priceTimeline[priceTimeline.length - 1]?.priceCop !== currentPriceStr
    ) {
      priceTimeline.push({
        recordedAt: (row.sourceUpdatedAt ?? new Date()).toISOString(),
        priceCop: currentPriceStr,
      })
    }

    results.push({
      id: row.id,
      title: row.title,
      city: row.city,
      neighborhood: row.neighborhood,
      zoneName: row.zoneName,
      propertyType: row.propertyType,
      priceCop: row.priceCop.toString(),
      areaM2: row.areaM2,
      areaPrivateM2: row.areaPrivateM2,
      pricePerM2: analysis.subjectPpm2,
      metricType: analysis.metricType,
      refAvgUsed: analysis.refPpm2,
      compSampleSize: analysis.compSampleSize,
      compMethod: analysis.compMethod,
      dealScore: analysis.dealScore,
      scoreBreakdown: analysis.breakdown,
      whyDeal,
      confidence: analysis.confidence,
      confidenceReasons: analysis.confidenceReasons,
      discountVsRefPct: analysis.discountVsRefPct,
      priceDropPct: analysis.priceDropPct,
      domDays: analysis.domDays,
      priceTimeline,
      acceptsBarter: row.acceptsBarter,
      terraceHeavy: row.terraceHeavyFlag,
      isProject: row.isProject,
      url: row.url,
      imageUrl: row.imageUrl,
      sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
    })
  }

  return results
    .sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1))
    .slice(0, limit)
}
