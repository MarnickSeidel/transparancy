import { unstable_cache } from "next/cache"

import { filterConjuntoVariants } from "@/lib/conjuntos"
import { prisma } from "@/lib/prisma"

async function fetchCityConjuntoNames(city: string): Promise<string[]> {
  const rows = await prisma.listing.groupBy({
    by: ["conjunto"],
    where: {
      city: city.trim(),
      isActive: true,
      conjunto: { not: null },
    },
  })

  return rows
    .map((r) => r.conjunto)
    .filter((c): c is string => c != null && c.trim().length > 0)
}

const cachedCityConjuntoNames = (city: string) =>
  unstable_cache(
    () => fetchCityConjuntoNames(city),
    ["city-conjunto-names", city.trim()],
    { revalidate: 300 },
  )()

/** All distinct conjunto spellings in a city that match the selected name. */
export async function resolveConjuntoVariants(
  city: string,
  conjunto: string,
): Promise<string[]> {
  const needle = conjunto.trim()
  const cityTrim = city.trim()
  if (!needle || !cityTrim) return []

  const names = await cachedCityConjuntoNames(cityTrim)
  return filterConjuntoVariants(names, needle)
}
