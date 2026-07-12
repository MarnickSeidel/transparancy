import { unstable_cache } from "next/cache"

import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"
import { prisma } from "@/lib/prisma"

type AliasMap = Map<string, string[]>

const buildAliasMap = (rows: Array<{ neighborhood: string | null }>): AliasMap => {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const raw = row.neighborhood?.trim()
    if (!raw) continue
    const key = normalizeNeighborhoodKey(raw)
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, [raw])
      continue
    }
    if (!prev.includes(raw)) prev.push(raw)
  }
  return map
}

export const getNeighborhoodAliasMap = (city?: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.listing.findMany({
        where: {
          isActive: true,
          neighborhood: { not: null },
          ...(city ? { city } : {}),
        },
        select: { neighborhood: true },
        distinct: ["neighborhood"],
      })
      return buildAliasMap(rows)
    },
    ["neighborhood-aliases", city ?? "all"],
    { revalidate: 300 },
  )()

export const resolveNeighborhoodFilter = async (
  neighborhood: string,
  city?: string,
): Promise<string | { in: string[] }> => {
  const key = normalizeNeighborhoodKey(neighborhood.trim())
  if (!key) return neighborhood

  const aliasMap = await getNeighborhoodAliasMap(city)
  const matches = aliasMap.get(key) ?? []
  if (matches.length === 0) return neighborhood
  if (matches.length === 1) return matches[0]
  return { in: matches }
}
