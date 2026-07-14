import type { Listing } from "@prisma/client"

import {
  analyzeDeal,
  buildWhyDeal,
  toDealListingInput,
} from "@/lib/dealEngine"
import { fetchAnalyzeCompPool } from "@/lib/fetchAnalyzeCompPool"
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
  }
  analysis: {
    dealScore: number | null
    verdict: ListingDetailVerdict
    confidence: "high" | "medium" | "low"
    warnings: string[]
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
  if (discountPct >= 12) return "good_deal"
  if (discountPct <= -12) return "overpriced"
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
  const poolRows = await fetchAnalyzeCompPool(listing)
  const pool = poolRows.map((r) => toDealListingInput(r))
  const subject = toDealListingInput(listing)
  const rowById = new Map(poolRows.map((r) => [r.id, r]))

  const priceEvents = await prisma.listingPriceEvent.findMany({
    where: {
      listingId: listing.id,
      recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
    },
    orderBy: { recordedAt: "desc" },
  })

  const analysis = analyzeDeal(subject, pool, {
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
    },
    analysis: {
      dealScore: analysis.dealScore,
      verdict,
      confidence: responseConfidence,
      warnings: analysis.excluded
        ? analysis.exclusionReasons
        : analysis.confidenceReasons,
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
    comps: analysis.selectedComps.slice(0, 8).flatMap((comp) => {
      const c = rowById.get(comp.id)
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
  const listing = await prisma.listing.findFirst({
    where: { id, isActive: true },
  })
  if (!listing) return null
  return buildListingDetailResponse(listing)
}
