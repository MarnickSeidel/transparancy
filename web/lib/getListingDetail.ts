import type { Listing } from "@prisma/client"

import {
  analyzeListingDeal,
  GOOD_DEAL_DISCOUNT_PCT,
  OVERPRICED_DISCOUNT_PCT,
} from "@/lib/dealCompPool"
import {
  buildWhyDeal,
  toDealListingInput,
} from "@/lib/dealEngine"
import { haversineMeters } from "@/lib/geoHaversine"
import { prisma } from "@/lib/prisma"

export type ListingDetailVerdict = "good_deal" | "fair" | "overpriced"

export type ListingDetailResponse = {
  listing: {
    id: string
    externalId: string
    title: string
    url: string
    city: string
    neighborhood: string | null
    zoneName: string | null
    propertyType: string | null
    operationType: string | null
    priceCop: string
    areaM2: number
    areaBuiltM2: number | null
    areaPrivateM2: number | null
    areaTerrainM2: number | null
    areaTerraceM2: number | null
    estrato: number | null
    bedrooms: number | null
    bathrooms: number | null
    garage: number | null
    pricePerM2: number | null
    acceptsBarter: boolean
    facilities: unknown
    constructionState: string | null
    latitude: number | null
    longitude: number | null
    address: string | null
    technicalSheet: unknown
    imageUrl: string | null
    sourceUpdatedAt: string | null
    isActive: boolean
  }
  analysis: {
    dealScore: number | null
    verdict: ListingDetailVerdict
    confidence: "high" | "medium" | "low"
    warnings: string[]
    excluded: boolean
    discountVsRefPct: number | null
    referencePpm2: number | null
    referencePpm2Nearby: number | null
    referencePpm2Neighborhood: number | null
    sampleSize: number
    compMethod: string
    metricType: string
    scoreBreakdown: unknown
    priceDropPct: number | null
    domDays: number | null
    whyDeal: ReturnType<typeof buildWhyDeal>
  }
  priceTimeline: Array<{ recordedAt: string; priceCop: string }>
  comps: Array<{
    id: string
    title: string
    city: string
    neighborhood: string | null
    priceCop: string
    areaM2: number
    pricePerM2: number | null
    distanceMeters: number | null
    url: string
  }>
}

function verdictFromDiscount(discountPct: number | null): ListingDetailVerdict {
  if (discountPct == null) return "fair"
  if (discountPct >= GOOD_DEAL_DISCOUNT_PCT) return "good_deal"
  if (discountPct <= OVERPRICED_DISCOUNT_PCT) return "overpriced"
  return "fair"
}

function verdictFromAnalysis(analysis: {
  compSampleSize: number
  refPpm2: number | null
  discountVsRefPct: number | null
}): ListingDetailVerdict {
  if (analysis.compSampleSize === 0 || analysis.refPpm2 == null) {
    return "fair"
  }
  return verdictFromDiscount(analysis.discountVsRefPct)
}

function confidenceForResponse(analysis: {
  compSampleSize: number
  refPpm2: number | null
  confidence: "high" | "medium" | "low"
}): "high" | "medium" | "low" {
  if (
    analysis.compSampleSize === 0 ||
    analysis.refPpm2 == null ||
    !Number.isFinite(analysis.refPpm2) ||
    analysis.refPpm2 <= 0
  ) {
    return "low"
  }
  return analysis.confidence
}

export async function buildListingDetailResponse(
  listing: Listing,
): Promise<ListingDetailResponse> {
  const subject = toDealListingInput(listing)

  const priceEvents = await prisma.listingPriceEvent.findMany({
    where: {
      listingId: listing.id,
      recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
    },
    orderBy: { recordedAt: "desc" },
  })

  // Same pool + house floor as opportunities (no requirePositiveDiscount here).
  const analysis = await analyzeListingDeal(subject, {
    priceEvents: priceEvents.map((e) => ({
      priceCop: e.priceCop,
      recordedAt: e.recordedAt,
    })),
  })

  const verdict = verdictFromAnalysis(analysis)
  const responseConfidence = confidenceForResponse(analysis)
  const whyDeal = buildWhyDeal(analysis, subject)

  const priceTimeline = [
    ...priceEvents.map((e) => ({
      recordedAt: e.recordedAt.toISOString(),
      priceCop: e.priceCop.toString(),
    })),
  ]
  const currentPriceStr = listing.priceCop.toString()
  const hasCurrent =
    priceTimeline.length === 0 ||
    priceTimeline[priceTimeline.length - 1]?.priceCop !== currentPriceStr
  if (hasCurrent) {
    priceTimeline.push({
      recordedAt: (listing.sourceUpdatedAt ?? new Date()).toISOString(),
      priceCop: currentPriceStr,
    })
  }

  const selectedCompIds = analysis.selectedComps.slice(0, 8).map((c) => c.id)
  const compRows =
    selectedCompIds.length > 0
      ? await prisma.listing.findMany({
          where: { id: { in: selectedCompIds } },
          select: {
            id: true,
            title: true,
            city: true,
            neighborhood: true,
            priceCop: true,
            areaM2: true,
            pricePerM2: true,
            latitude: true,
            longitude: true,
            url: true,
          },
        })
      : []
  const rowById = new Map(compRows.map((r) => [r.id, r]))

  return {
    listing: {
      id: listing.id,
      externalId: listing.externalId,
      title: listing.title,
      url: listing.url,
      city: listing.city,
      neighborhood: listing.neighborhood,
      zoneName: listing.zoneName,
      propertyType: listing.propertyType,
      operationType: listing.operationType,
      priceCop: listing.priceCop.toString(),
      areaM2: listing.areaM2,
      areaBuiltM2: listing.areaBuiltM2,
      areaPrivateM2: listing.areaPrivateM2,
      areaTerrainM2: listing.areaTerrainM2,
      areaTerraceM2: listing.areaTerraceM2,
      estrato: listing.estrato,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      garage: listing.garage,
      pricePerM2: analysis.subjectPpm2,
      acceptsBarter: listing.acceptsBarter,
      facilities: listing.facilities,
      constructionState: listing.constructionState,
      latitude: listing.latitude,
      longitude: listing.longitude,
      address: listing.address,
      technicalSheet: listing.technicalSheet,
      imageUrl: listing.imageUrl,
      sourceUpdatedAt: listing.sourceUpdatedAt?.toISOString() ?? null,
      isActive: listing.isActive,
    },
    analysis: {
      dealScore: analysis.dealScore,
      verdict,
      confidence: responseConfidence,
      warnings: analysis.excluded
        ? analysis.exclusionReasons
        : analysis.confidenceReasons,
      excluded: analysis.excluded,
      discountVsRefPct: analysis.discountVsRefPct,
      referencePpm2: analysis.refPpm2,
      referencePpm2Nearby: analysis.refPpm2,
      referencePpm2Neighborhood: analysis.refPpm2,
      sampleSize: analysis.compSampleSize,
      compMethod: analysis.compMethod,
      metricType: analysis.metricType,
      scoreBreakdown: analysis.breakdown,
      priceDropPct: analysis.priceDropPct,
      domDays: analysis.domDays,
      whyDeal,
    },
    priceTimeline,
    comps: selectedCompIds.flatMap((id) => {
      const c = rowById.get(id)
      if (!c) return []
      let distanceMeters: number | null = null
      if (
        listing.latitude != null &&
        listing.longitude != null &&
        c.latitude != null &&
        c.longitude != null
      ) {
        distanceMeters = haversineMeters(
          listing.latitude,
          listing.longitude,
          c.latitude,
          c.longitude,
        )
      }
      return [
        {
          id: c.id,
          title: c.title,
          city: c.city,
          neighborhood: c.neighborhood,
          priceCop: c.priceCop.toString(),
          areaM2: c.areaM2,
          pricePerM2: c.pricePerM2,
          distanceMeters,
          url: c.url,
        },
      ]
    }),
  }
}

export async function getListingDetail(
  id: string,
): Promise<ListingDetailResponse | null> {
  // Include inactive rows so opportunity / shared links still open with a clear notice.
  const listing = await prisma.listing.findUnique({
    where: { id },
  })
  if (!listing) return null
  return buildListingDetailResponse(listing)
}
