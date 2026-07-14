import { prisma } from "@/lib/prisma"

export type DataFreshness = {
  lastScrapedAt: Date | null
  activeSeenLast7Days: number
}

/** unstable_cache serializes dates as strings — normalize before use. */
export const normalizeDataFreshness = (
  raw: DataFreshness | { lastScrapedAt: Date | string | null; activeSeenLast7Days: number },
): DataFreshness => {
  const value = raw.lastScrapedAt
  if (!value) {
    return { lastScrapedAt: null, activeSeenLast7Days: raw.activeSeenLast7Days }
  }
  if (value instanceof Date) {
    return { lastScrapedAt: value, activeSeenLast7Days: raw.activeSeenLast7Days }
  }
  const parsed = new Date(value)
  return {
    lastScrapedAt: Number.isNaN(parsed.getTime()) ? null : parsed,
    activeSeenLast7Days: raw.activeSeenLast7Days,
  }
}

export async function getGlobalDataFreshness(): Promise<DataFreshness> {
  const [scraped, seen] = await Promise.all([
    prisma.listing.aggregate({
      where: { isActive: true },
      _max: { dateScraped: true },
    }),
    prisma.listing.count({
      where: {
        isActive: true,
        lastSeenAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
    }),
  ])

  return {
    lastScrapedAt: scraped._max.dateScraped,
    activeSeenLast7Days: seen,
  }
}

export const formatFreshnessDate = (
  date: Date | null | undefined,
  locale: string,
): string | null => {
  if (!date) return null
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
