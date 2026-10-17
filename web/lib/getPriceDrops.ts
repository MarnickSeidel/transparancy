import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { domDaysFromFirstSeen } from "@/lib/formatDom"

export type PriceDropRow = {
  id: string
  listingId: string
  title: string
  url: string
  city: string
  neighborhood: string | null
  propertyType: string | null
  priceCop: string
  previousPriceCop: string
  dropPct: number
  dropCop: number
  recordedAt: string
  imageUrl: string | null
  domDays: number | null
}

export type PriceDropQuery = {
  city?: string | null
  limit?: number
  days?: number
}

export async function getRecentPriceDrops(
  query: PriceDropQuery = {},
): Promise<PriceDropRow[]> {
  const limit = Math.min(100, Math.max(1, query.limit ?? 30))
  const days = Math.min(90, Math.max(1, query.days ?? 30))
  const city = query.city?.trim()

  const cityFilter =
    city && city !== "all"
      ? Prisma.sql`AND l.city = ${city}`
      : Prisma.empty

  const rows = await prisma.$queryRaw<
    Array<{
      event_id: string
      listing_id: string
      title: string
      url: string
      city: string
      neighborhood: string | null
      property_type: string | null
      price_cop: bigint
      prev_price_cop: bigint
      recorded_at: Date
      image_url: string | null
      first_seen_at: Date
    }>
  >(Prisma.sql`
    WITH recent_events AS (
      SELECT
        e.id AS event_id,
        e.listing_id,
        e.price_cop,
        e.recorded_at
      FROM listing_price_events e
      WHERE e.recorded_at >= NOW() - (${days} * INTERVAL '1 day')
    ),
    drops AS (
      SELECT
        r.event_id,
        r.listing_id,
        r.price_cop,
        r.recorded_at,
        prev.price_cop AS prev_price_cop
      FROM recent_events r
      JOIN LATERAL (
        SELECT e2.price_cop
        FROM listing_price_events e2
        WHERE e2.listing_id = r.listing_id
          AND (e2.recorded_at, e2.id) < (r.recorded_at, r.event_id)
        ORDER BY e2.recorded_at DESC, e2.id DESC
        LIMIT 1
      ) prev ON true
      WHERE prev.price_cop > r.price_cop
    )
    SELECT
      d.event_id,
      d.listing_id,
      l.title,
      l.url,
      l.city,
      l.neighborhood,
      l.property_type,
      d.price_cop,
      d.prev_price_cop,
      d.recorded_at,
      l.image_url,
      l.first_seen_at
    FROM drops d
    JOIN listings l ON l.id = d.listing_id
    WHERE l.is_active = true
      ${cityFilter}
    ORDER BY d.recorded_at DESC, (d.prev_price_cop - d.price_cop) DESC
    LIMIT ${limit}
  `)

  return rows.map((row) => {
    const prev = Number(row.prev_price_cop)
    const current = Number(row.price_cop)
    const dropCop = prev - current
    const dropPct = prev > 0 ? (dropCop / prev) * 100 : 0

    return {
      id: row.event_id,
      listingId: row.listing_id,
      title: row.title,
      url: row.url,
      city: row.city,
      neighborhood: row.neighborhood,
      propertyType: row.property_type,
      priceCop: row.price_cop.toString(),
      previousPriceCop: row.prev_price_cop.toString(),
      dropPct,
      dropCop,
      recordedAt: row.recorded_at.toISOString(),
      imageUrl: row.image_url,
      domDays: domDaysFromFirstSeen(row.first_seen_at),
    }
  })
}
