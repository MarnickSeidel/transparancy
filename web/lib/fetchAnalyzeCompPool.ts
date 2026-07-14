import type { Listing, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const POOL_TARGET = 400

export async function fetchAnalyzeCompPool(subject: Listing): Promise<Listing[]> {
  const baseWhere: Prisma.ListingWhereInput = {
    city: subject.city,
    isActive: true,
    operationType: { contains: "venta", mode: "insensitive" },
    pricePerM2: { not: null },
    id: { not: subject.id },
  }

  const propertyTypeFilter: Prisma.ListingWhereInput = subject.propertyType
    ? { propertyType: { equals: subject.propertyType, mode: "insensitive" } }
    : {}

  const tiers: Prisma.ListingWhereInput[] = [
    {
      ...baseWhere,
      ...propertyTypeFilter,
      ...(subject.neighborhood ? { neighborhood: subject.neighborhood } : {}),
      ...(subject.estrato != null ? { estrato: subject.estrato } : {}),
    },
    {
      ...baseWhere,
      ...propertyTypeFilter,
      ...(subject.neighborhood ? { neighborhood: subject.neighborhood } : {}),
    },
    {
      ...baseWhere,
      ...propertyTypeFilter,
      ...(subject.estrato != null ? { estrato: subject.estrato } : {}),
    },
    {
      ...baseWhere,
      ...propertyTypeFilter,
    },
  ]

  if (!subject.propertyType) {
    tiers.push(baseWhere)
  }

  const seen = new Set<string>()
  const pool: Listing[] = []

  for (const where of tiers) {
    const rows = await prisma.listing.findMany({
      where,
      take: POOL_TARGET,
      orderBy: { dateScraped: "desc" },
    })
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      pool.push(row)
    }
    if (pool.length >= POOL_TARGET) break
  }

  return pool
}
