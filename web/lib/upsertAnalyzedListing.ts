import type { Listing, Prisma } from "@prisma/client"

import type { ParsedListing } from "@/lib/fincaraizSingleListing"
import { prisma } from "@/lib/prisma"

const toPpm2 = (price: number, area: number | null): number | null => {
  if (area == null || area <= 0) return null
  return price / area
}

export type UpsertAnalyzedListingResult = {
  listing: Listing
  created: boolean
  priceChanged: boolean
}

/**
 * Persist a portal-parsed listing: create if new, update if known
 * (by externalId or canonical URL). Records a price event when price changes.
 */
export const upsertAnalyzedListing = async (
  parsed: ParsedListing,
): Promise<UpsertAnalyzedListingResult> => {
  const now = new Date()
  const priceCop = BigInt(parsed.priceCop)
  const pricePerM2 = toPpm2(parsed.priceCop, parsed.areaM2)
  const pricePerM2Built = toPpm2(parsed.priceCop, parsed.areaBuiltM2)
  const pricePerM2Terrain = toPpm2(parsed.priceCop, parsed.areaTerrainM2)

  const prior =
    (await prisma.listing.findUnique({
      where: { externalId: parsed.externalId },
    })) ??
    (await prisma.listing.findFirst({
      where: { url: parsed.url },
      orderBy: { lastSeenAt: "desc" },
    }))

  const priceChanged = prior != null && prior.priceCop !== priceCop
  const fingerprintChanged =
    prior != null &&
    prior.sourceFingerprint != null &&
    prior.sourceFingerprint !== parsed.sourceFingerprint
  const contentChanged = priceChanged || fingerprintChanged

  const sharedFields = {
    title: parsed.title,
    url: parsed.url,
    priceCop,
    areaM2: parsed.areaM2,
    estrato: parsed.estrato,
    neighborhood: parsed.neighborhood,
    city: parsed.city,
    department: parsed.department,
    propertyType: parsed.propertyType,
    operationType: parsed.operationType,
    areaBuiltM2: parsed.areaBuiltM2,
    areaTerrainM2: parsed.areaTerrainM2,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    pricePerM2,
    pricePerM2Built,
    pricePerM2Terrain,
    imageUrl: parsed.imageUrl,
    address: parsed.address,
    technicalSheet: parsed.technicalSheet ?? undefined,
    description: parsed.description,
    locationPath: parsed.locationPath as Prisma.InputJsonValue,
    sourceFingerprint: parsed.sourceFingerprint,
    sourceUpdatedAt: now,
    dateScraped: now,
    lastSeenAt: now,
    isActive: true,
    ...(contentChanged ? { lastChangedAt: now } : {}),
  }

  let listing: Listing
  let created = false

  if (prior) {
    listing = await prisma.listing.update({
      where: { id: prior.id },
      data: {
        ...sharedFields,
        // Keep the established external id; sync URL/metadata from the portal.
        externalId: prior.externalId,
        timesSeen: { increment: 1 },
      },
    })
  } else {
    created = true
    listing = await prisma.listing.create({
      data: {
        externalId: parsed.externalId,
        ...sharedFields,
        sourceCreatedAt: now,
        firstSeenAt: now,
        timesSeen: 1,
      },
    })
  }

  if (priceChanged) {
    await prisma.listingPriceEvent.create({
      data: {
        listingId: listing.id,
        externalId: listing.externalId,
        priceCop,
        recordedAt: now,
      },
    })
  }

  return { listing, created, priceChanged }
}

/** Persist deal-engine score from a live analyze pass (aligned with scraper). */
export const persistAnalyzedDealScore = async (
  listingId: string,
  analysis: {
    dealScore: number | null
    excluded?: boolean
    discountVsRefPct: number | null
  },
): Promise<void> => {
  const dealScore = analysis.dealScore
  if (dealScore == null || !Number.isFinite(dealScore)) return
  const isDeal =
    !analysis.excluded &&
    analysis.discountVsRefPct != null &&
    analysis.discountVsRefPct > 0
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      dealScore,
      isDeal,
    },
  })
}
