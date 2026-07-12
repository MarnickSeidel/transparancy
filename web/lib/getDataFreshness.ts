import { prisma } from "@/lib/prisma"

export type DataFreshness = {
  lastScrapedAt: Date | null
  activeSeenLast7Days: number
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
