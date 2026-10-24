import type { Prisma } from "@prisma/client"

import { MIN_ANALYTICS_AREA_M2 } from "@/lib/analytics"
import {
  analyzeListingDeal,
  getCityHouseFloor,
  getDealCompPool,
  getNearbyDealCompsForPoints,
  getPlaceholderCoordKeys,
  GOOD_DEAL_DISCOUNT_PCT,
  hasPlaceholderCoords,
  mergeCompPools,
  poolCacheKeyForPropertyType,
} from "@/lib/dealCompPool"
import {
  buildWhyDeal,
  toDealListingInput,
  type DealListingInput,
  type MetricType,
} from "@/lib/dealEngine"
import { buildDealReview, hasBorrowedReference, type DealReview } from "@/lib/dealReview"
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"
import { resolveConjuntoVariants } from "@/lib/resolveConjuntoVariants"

export const DEFAULT_OPPORTUNITIES_CITY = "Pereira"
export const DEFAULT_OPPORTUNITIES_PAGE_SIZE = 10
/** Cap for live opportunities list / map payloads (markers stay cheap at this size). */
export const MAX_OPPORTUNITIES_RESULTS = 120
/** Default floor = good-deal verdict threshold so list cards match detail. */
export const DEFAULT_MIN_OPPORTUNITY_DISCOUNT_PCT = GOOD_DEAL_DISCOUNT_PCT

const SCORE_POOL_SIZE = 220
const VALUE_POOL_SIZE = 120
const MID_TIER_POOL_SIZE = 200
const MAX_CANDIDATES = 350
const MAX_RESULTS = MAX_OPPORTUNITIES_RESULTS
/**
 * Cap live re-analysis. Candidates are pre-ranked by stored `dealScore`
 * (refresh_derived_data); we only re-run analyzeDeal to enrich UI fields
 * and apply discount/confidence filters.
 */
const ANALYZE_CAP = 140
/** Ignore stored scores driven by implausible COP/m² (bad scrapes). */
const CANDIDATE_PPM2_FLOOR = 400_000
const MID_TIER_DEAL_SCORE_MIN = 45
const MID_TIER_DEAL_SCORE_MAX = 82

export type OpportunitySortBy = "dealScore" | "discount" | "price" | "confidence"

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
  dealScore: true,
  url: true,
  imageUrl: true,
  isActive: true,
} satisfies Prisma.ListingSelect

type ListingRow = Prisma.ListingGetPayload<{ select: typeof listingSelect }>

export type OpportunityQuery = {
  city?: string | null
  /** One or more property types; empty / omit = any. */
  propertyTypes?: string[]
  /** @deprecated use propertyTypes */
  propertyType?: string | null
  /** One or more barrios; a listing matches if it matches any. Empty / omit = any. */
  neighborhoods?: string[]
  /** @deprecated use neighborhoods */
  neighborhood?: string | null
  excludeNeighborhoods?: string[]
  excludeUnknownNeighborhoods?: boolean
  hideLowConfidence?: boolean
  /** Drop rows flagged by `buildDealReview` (extreme or borrowed-comp discounts). */
  hideReview?: boolean
  excludeBarter?: boolean
  excludeProjects?: boolean
  minDiscountPct?: number
  maxPriceCop?: bigint | null
  minPriceCop?: bigint | null
  minAreaM2?: number | null
  maxAreaM2?: number | null
  /** One or more estratos; empty / omit = any. */
  estratos?: number[]
  /** @deprecated use estratos */
  estrato?: number | null
  conjunto?: string | null
  latitude?: number | null
  longitude?: number | null
  radiusMeters?: number | null
  page?: number
  pageSize?: number
  sortBy?: OpportunitySortBy
  /** @deprecated use pageSize */
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
  estrato: number | null
  bedrooms: number | null
  bathrooms: number | null
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
  review: DealReview
  promoted: boolean
  priceDropPct: number | null
  domDays: number | null
  priceTimeline: Array<{ recordedAt: string; priceCop: string }>
  acceptsBarter: boolean
  terraceHeavy: boolean
  isProject: boolean
  url: string
  imageUrl: string | null
  sourceUpdatedAt: string | null
  latitude: number | null
  longitude: number | null
}

export type OpportunitiesResult = {
  items: OpportunityRow[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
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

/** Same label the opportunities barrio column shows: zone when the portal stored the city as the barrio. */
function displayedBarrioKey(
  neighborhood: string | null,
  zoneName: string | null,
  city: string | null,
): string {
  const barrio = neighborhood?.trim() ?? ""
  const zone = zoneName?.trim() ?? ""
  const cityName = city?.trim() ?? ""
  const label =
    barrio && barrio.toLowerCase() !== cityName.toLowerCase() ? barrio : zone || barrio
  return label ? normalizeNeighborhoodKey(label) : ""
}

/** "belmonte" matches Villa - belmonte, Belmonte alto, and a zone of that name. */
function barrioHaystack(neighborhood: string | null, zoneName: string | null): string {
  return `${normalizeNeighborhoodKey(neighborhood ?? "")}${normalizeNeighborhoodKey(zoneName ?? "")}`
}

function matchesSelectedBarrio(
  neighborhood: string | null,
  zoneName: string | null,
  selectedKey: string,
): boolean {
  const haystack = barrioHaystack(neighborhood, zoneName)
  return haystack.includes(selectedKey)
}

function neighborhoodQueryTokens(raw: string): string[] {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function neighborhoodPassesFilters(
  neighborhood: string | null,
  zoneName: string | null,
  city: string | null,
  selectedNeighborhoodKeys: string[],
  excludedNeighborhoodKeys: Set<string>,
  excludeUnknownNeighborhoods: boolean,
): boolean {
  const raw = neighborhood?.trim() ?? ""
  const key = raw ? normalizeNeighborhoodKey(raw) : ""
  const shown = displayedBarrioKey(neighborhood, zoneName, city)
  if (
    selectedNeighborhoodKeys.length > 0 &&
    !selectedNeighborhoodKeys.some((k) => matchesSelectedBarrio(neighborhood, zoneName, k))
  ) {
    return false
  }
  if (
    excludedNeighborhoodKeys.size > 0 &&
    ((key && excludedNeighborhoodKeys.has(key)) ||
      (shown && excludedNeighborhoodKeys.has(shown)))
  ) {
    return false
  }
  if (excludeUnknownNeighborhoods) {
    if (!raw) return false
    if (key === "desconocido" || key === "unknown") return false
  }
  return true
}

function applyGeoBBoxFilter(
  andFilters: Prisma.ListingWhereInput[],
  lat: number,
  lng: number,
  radiusM: number,
): void {
  const latDelta = radiusM / 111_320
  const lngDelta =
    radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  andFilters.push({
    latitude: { not: null, gte: lat - latDelta, lte: lat + latDelta },
    longitude: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
  })
}

function mergeCandidateRows(...groups: ListingRow[][]): ListingRow[] {
  const seen = new Set<string>()
  const merged: ListingRow[] = []
  for (const group of groups) {
    for (const row of group) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      merged.push(row)
    }
  }
  return merged
}

export function sortOpportunityRows(
  rows: OpportunityRow[],
  sortBy: OpportunitySortBy,
): OpportunityRow[] {
  const confidenceWeight: Record<NonNullable<OpportunityRow["confidence"]>, number> = {
    high: 3,
    medium: 2,
    low: 1,
  }

  return [...rows].sort((a, b) => {
    if (sortBy === "discount") {
      const va =
        a.discountVsRefPct != null && Number.isFinite(a.discountVsRefPct)
          ? a.discountVsRefPct
          : -999
      const vb =
        b.discountVsRefPct != null && Number.isFinite(b.discountVsRefPct)
          ? b.discountVsRefPct
          : -999
      return vb - va
    }
    if (sortBy === "price") {
      const va = Number(String(a.priceCop).replace(/\D/g, "")) || 0
      const vb = Number(String(b.priceCop).replace(/\D/g, "")) || 0
      return va - vb
    }
    if (sortBy === "confidence") {
      const aw = a.confidence ? confidenceWeight[a.confidence] : 0
      const bw = b.confidence ? confidenceWeight[b.confidence] : 0
      return bw - aw
    }
    const va = a.dealScore != null && Number.isFinite(a.dealScore) ? a.dealScore : -999
    const vb = b.dealScore != null && Number.isFinite(b.dealScore) ? b.dealScore : -999
    return vb - va
  })
}

function buildBaseFilters(query: OpportunityQuery): {
  andFilters: Prisma.ListingWhereInput[]
  selectedNeighborhoodKeys: string[]
  excludedNeighborhoodKeys: Set<string>
  useGeo: boolean
} {
  const {
    city,
    propertyTypes = [],
    propertyType,
    neighborhoods = [],
    neighborhood,
    excludeNeighborhoods = [],
    maxPriceCop = null,
    minPriceCop = null,
    minAreaM2 = null,
    maxAreaM2 = null,
    estratos = [],
    estrato = null,
    latitude = null,
    longitude = null,
    radiusMeters = null,
    excludeBarter = false,
    excludeProjects = false,
  } = query

  const useGeo =
    latitude != null &&
    longitude != null &&
    radiusMeters != null &&
    radiusMeters >= 300

  const selectedNeighborhoodRaws = useGeo
    ? []
    : Array.from(
        new Set(
          [...neighborhoods, ...(neighborhood ? [neighborhood] : [])]
            .map((n) => n.trim())
            .filter(Boolean),
        ),
      )
  const selectedNeighborhoodKeys = selectedNeighborhoodRaws
    .map((n) => normalizeNeighborhoodKey(n))
    .filter(Boolean)
  const excludedNeighborhoodKeys = parseExcludeNeighborhoods(excludeNeighborhoods)

  const estratoFilter = Array.from(
    new Set(
      [
        ...estratos,
        ...(estrato != null && Number.isFinite(estrato) ? [estrato] : []),
      ].filter((n) => Number.isFinite(n) && n >= 1 && n <= 6),
    ),
  ).sort((a, b) => a - b)

  const propertyTypeFilter = Array.from(
    new Set(
      [...propertyTypes, ...(propertyType ? [propertyType] : [])]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  )

  const andFilters: Prisma.ListingWhereInput[] = [
    {
      isActive: true,
      pricePerM2: { not: null, gte: CANDIDATE_PPM2_FLOOR },
      areaM2: { gte: MIN_ANALYTICS_AREA_M2 },
      operationType: { contains: "venta", mode: "insensitive" },
    },
  ]

  if (maxPriceCop != null) andFilters.push({ priceCop: { lte: maxPriceCop } })
  if (minPriceCop != null) andFilters.push({ priceCop: { gte: minPriceCop } })
  if (city && city !== "all") andFilters.push({ city })
  if (propertyTypeFilter.length === 1) {
    andFilters.push({ propertyType: propertyTypeFilter[0] })
  } else if (propertyTypeFilter.length > 1) {
    andFilters.push({ propertyType: { in: propertyTypeFilter } })
  }
  if (estratoFilter.length === 1) {
    andFilters.push({ estrato: estratoFilter[0] })
  } else if (estratoFilter.length > 1) {
    andFilters.push({ estrato: { in: estratoFilter } })
  }
  if (minAreaM2 != null || maxAreaM2 != null) {
    andFilters.push({
      areaM2: {
        ...(minAreaM2 != null
          ? { gte: Math.max(MIN_ANALYTICS_AREA_M2, minAreaM2) }
          : { gte: MIN_ANALYTICS_AREA_M2 }),
        ...(maxAreaM2 != null ? { lte: maxAreaM2 } : {}),
      },
    })
  }
  if (useGeo) {
    applyGeoBBoxFilter(andFilters, latitude!, longitude!, radiusMeters!)
  }
  if (excludeBarter) andFilters.push({ acceptsBarter: false })
  if (excludeProjects) andFilters.push({ isProject: false })
  const neighborhoodTokenGroups = selectedNeighborhoodRaws.map(neighborhoodQueryTokens)
  // A barrio with no usable tokens can't be pre-filtered in SQL; rely on the key match instead.
  if (
    neighborhoodTokenGroups.length > 0 &&
    neighborhoodTokenGroups.every((tokens) => tokens.length > 0)
  ) {
    andFilters.push({
      OR: neighborhoodTokenGroups.map((tokens) => ({
        AND: tokens.map((token) => ({
          OR: [
            { neighborhood: { contains: token, mode: "insensitive" as const } },
            { zoneName: { contains: token, mode: "insensitive" as const } },
          ],
        })),
      })),
    })
  }

  return {
    andFilters,
    selectedNeighborhoodKeys,
    excludedNeighborhoodKeys,
    useGeo,
  }
}

function rowToOpportunity(
  row: ListingRow,
  analysis: Awaited<ReturnType<typeof analyzeListingDeal>>,
  priceEvents: { priceCop: bigint; recordedAt: Date }[] | undefined,
): OpportunityRow {
  const whyDeal = buildWhyDeal(analysis, toDealListingInput(row))
  const priceTimeline = (priceEvents ?? []).map((e) => ({
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

  return {
    id: row.id,
    title: row.title,
    city: row.city,
    neighborhood: row.neighborhood,
    zoneName: row.zoneName,
    propertyType: row.propertyType,
    priceCop: row.priceCop.toString(),
    areaM2: row.areaM2,
    areaPrivateM2: row.areaPrivateM2,
    estrato: row.estrato,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
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
    review: buildDealReview({
      discountPct: analysis.discountVsRefPct,
      compMethod: analysis.compMethod,
      city: row.city,
      subjectNeighborhood: row.neighborhood,
      subjectZoneName: row.zoneName,
      comps: analysis.selectedComps,
    }),
    promoted: Boolean(row.paidQuota) || (row.highlight ?? 0) > 0,
    priceDropPct: analysis.priceDropPct,
    domDays: analysis.domDays,
    priceTimeline,
    acceptsBarter: row.acceptsBarter,
    terraceHeavy: row.terraceHeavyFlag,
    isProject: row.isProject,
    url: row.url,
    imageUrl: row.imageUrl,
    sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

/** City-scoped ranked opportunities with pagination and server-side sort. */
export async function getTopOpportunities(
  query: OpportunityQuery,
): Promise<OpportunitiesResult> {
  const {
    city,
    excludeUnknownNeighborhoods = false,
    hideLowConfidence = true,
    hideReview = false,
    minDiscountPct = DEFAULT_MIN_OPPORTUNITY_DISCOUNT_PCT,
    conjunto = null,
    page = 1,
    sortBy = "dealScore",
  } = query

  const pageSize = Math.min(
    MAX_OPPORTUNITIES_RESULTS,
    Math.max(1, query.pageSize ?? query.limit ?? DEFAULT_OPPORTUNITIES_PAGE_SIZE),
  )
  const safePage = Math.max(1, page)

  const empty = (): OpportunitiesResult => ({
    items: [],
    total: 0,
    page: safePage,
    pageSize,
    hasMore: false,
  })

  if (!city || city === "all") return empty()

  const { andFilters, selectedNeighborhoodKeys, excludedNeighborhoodKeys } =
    buildBaseFilters(query)

  if (conjunto?.trim()) {
    const variants = await resolveConjuntoVariants(city, conjunto)
    if (variants.length > 1) {
      andFilters.push({ conjunto: { in: variants } })
    } else {
      andFilters.push({ conjunto: variants[0] ?? conjunto.trim() })
    }
  }

  const where = { AND: andFilters }

  const scoreWhere: Prisma.ListingWhereInput = {
    AND: [...andFilters, { dealScore: { not: null } }],
  }
  const midTierWhere: Prisma.ListingWhereInput = {
    AND: [
      ...andFilters,
      {
        dealScore: {
          gte: MID_TIER_DEAL_SCORE_MIN,
          lte: MID_TIER_DEAL_SCORE_MAX,
        },
      },
    ],
  }

  // Prefer stored dealScore pool first; mid/value pools only diversify coverage.
  const [scoreRows, valueRows, midTierRows, houseFloor, placeholderKeys] = await Promise.all([
    prisma.listing.findMany({
      where: scoreWhere,
      orderBy: [{ dealScore: "desc" }, { dateScraped: "desc" }],
      take: SCORE_POOL_SIZE,
      select: listingSelect,
    }),
    prisma.listing.findMany({
      where,
      orderBy: [{ pricePerM2: "asc" }, { dealScore: "desc" }],
      take: VALUE_POOL_SIZE,
      select: listingSelect,
    }),
    prisma.listing.findMany({
      where: midTierWhere,
      orderBy: [{ pricePerM2: "asc" }, { dealScore: "desc" }],
      take: MID_TIER_POOL_SIZE,
      select: listingSelect,
    }),
    getCityHouseFloor(city),
    getPlaceholderCoordKeys(city),
  ])
  const placeholderCoordKeys = new Set(placeholderKeys)

  const mergedRows = mergeCandidateRows(scoreRows, midTierRows, valueRows)
  const filteredRows = mergedRows
    .filter((r) => r.isActive)
    .filter((r) =>
      neighborhoodPassesFilters(
        r.neighborhood,
        r.zoneName,
        r.city,
        selectedNeighborhoodKeys,
        excludedNeighborhoodKeys,
        excludeUnknownNeighborhoods,
      ),
    )
    .slice(0, MAX_CANDIDATES)

  if (filteredRows.length === 0) return empty()

  const sortedCandidates = [...filteredRows].sort((a, b) => {
    const scoreA = a.dealScore ?? -Infinity
    const scoreB = b.dealScore ?? -Infinity
    if (scoreB !== scoreA) return scoreB - scoreA
    const ppm2A = a.pricePerM2 ?? Infinity
    const ppm2B = b.pricePerM2 ?? Infinity
    return ppm2A - ppm2B
  })

  const analyzeLimit = Math.min(sortedCandidates.length, ANALYZE_CAP)
  const analyzeSlice = sortedCandidates.slice(0, analyzeLimit)
  const analyzeIds = analyzeSlice.map((r) => r.id)

  const typeKeys = Array.from(
    new Set(
      analyzeSlice.map((r) => poolCacheKeyForPropertyType(r.propertyType)),
    ),
  )
  const [priceEventsRaw, descriptionRows, ...typePools] = await Promise.all([
    prisma.listingPriceEvent.findMany({
      where: {
        listingId: { in: analyzeIds },
        recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
      },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.listing.findMany({
      where: { id: { in: analyzeIds } },
      select: { id: true, description: true },
    }),
    ...typeKeys.map((key) => {
      const sample = analyzeSlice.find(
        (r) => poolCacheKeyForPropertyType(r.propertyType) === key,
      )
      return getDealCompPool(city, sample?.propertyType ?? null)
    }),
  ])

  const nearbyPools = await Promise.all(
    typeKeys.map((key) => {
      const sample = analyzeSlice.find(
        (r) => poolCacheKeyForPropertyType(r.propertyType) === key,
      )
      const points = analyzeSlice
        .filter((r) => poolCacheKeyForPropertyType(r.propertyType) === key)
        .filter(
          (r) =>
            r.latitude != null &&
            r.longitude != null &&
            !hasPlaceholderCoords(r, placeholderCoordKeys),
        )
        .map((r) => ({
          latitude: r.latitude as number,
          longitude: r.longitude as number,
        }))
      return getNearbyDealCompsForPoints(city, sample?.propertyType ?? null, points)
    }),
  )

  const poolByType = new Map<string, DealListingInput[]>()
  typeKeys.forEach((key, i) => {
    poolByType.set(key, mergeCompPools(typePools[i] ?? [], nearbyPools[i] ?? []))
  })
  const descriptionById = new Map(
    descriptionRows.map((row) => [row.id, row.description]),
  )

  const priceEventsByListing = new Map<string, { priceCop: bigint; recordedAt: Date }[]>()
  for (const ev of priceEventsRaw) {
    const arr = priceEventsByListing.get(ev.listingId) ?? []
    arr.push({ priceCop: ev.priceCop, recordedAt: ev.recordedAt })
    priceEventsByListing.set(ev.listingId, arr)
  }

  const allResults: OpportunityRow[] = []

  for (const row of analyzeSlice) {
    if (allResults.length >= MAX_RESULTS) break

    const subject = toDealListingInput({
      ...row,
      description: descriptionById.get(row.id) ?? null,
    })
    const typeKey = poolCacheKeyForPropertyType(row.propertyType)
    const pool = poolByType.get(typeKey) ?? []
    const analysis = await analyzeListingDeal(subject, {
      priceEvents: priceEventsByListing.get(row.id),
      requirePositiveDiscount: true,
      pool,
      houseFloor,
      placeholderCoordKeys,
    })
    if (analysis.excluded) continue
    if (
      analysis.discountVsRefPct == null ||
      analysis.discountVsRefPct < minDiscountPct
    ) {
      continue
    }
    if (hideLowConfidence && analysis.confidence === "low") continue

    const opportunity = rowToOpportunity(row, analysis, priceEventsByListing.get(row.id))
    if (hasBorrowedReference(opportunity.review)) continue
    if (hideReview && opportunity.review.needsReview) continue
    allResults.push(opportunity)
  }

  const sorted = sortOpportunityRows(allResults, sortBy)
  const total = sorted.length
  const offset = (safePage - 1) * pageSize
  const items = sorted.slice(offset, offset + pageSize)

  return {
    items,
    total,
    page: safePage,
    pageSize,
    hasMore: offset + pageSize < total,
  }
}
