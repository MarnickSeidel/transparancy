import { compMethodLabel } from "@/lib/dealLabels"
import { listFacilities } from "@/lib/formatFacilities"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { narrativeCopy } from "@/lib/listingNarrativeCopy"
import {
  formatDistanceM,
  type NearbyAmenitiesResult,
  type PoiCategoryId,
} from "@/lib/nearbyAmenities"
import { propertyTypeLabel } from "@/lib/propertyTypes"

export type ListingNarrativeInput = {
  listingId: string
  lang: Lang
  locale: string
  city: string
  neighborhood: string | null
  propertyType: string | null
  areaM2: number
  estrato: number | null
  bedrooms: number | null
  bathrooms: number | null
  facilities: unknown
  verdict: "good_deal" | "fair" | "overpriced"
  confidence: "high" | "medium" | "low"
  discountVsRefPct: number | null
  sampleSize: number
  referencePpm2: number | null
  compMethod: string | null
  priceDropPct: number | null
  domDays: number | null
  nearby: NearbyAmenitiesResult | null
}

/** Walk-narrative categories stay focused; zone UI surfaces the fuller set. */
const CATEGORY_PRIORITY: PoiCategoryId[] = [
  "parks",
  "food",
  "groceries",
  "sports",
  "transit",
  "education",
  "health",
  "services",
]

const WALK_CATEGORY_PRIORITY: PoiCategoryId[] = [
  "parks",
  "groceries",
  "transit",
  "education",
  "health",
]

const LONG_DOM_DAYS = 45
const WALK_FULL_MIN_CATEGORIES = 4

/** Stable 32-bit hash so the same listing keeps the same wording. */
function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickVariant(variants: readonly string[], seed: number, salt: number): string {
  if (variants.length === 0) return ""
  return variants[(seed + salt * 97) % variants.length]!
}

function fill(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value),
    template,
  )
}

function placeLine(city: string, neighborhood: string | null): string {
  const barrio = neighborhood?.trim()
  const ciudad = city.trim()
  if (barrio && ciudad) return `${barrio}, ${ciudad}`
  return barrio || ciudad || "—"
}

function joinList(labels: string[], lang: Lang): string {
  if (labels.length === 0) return ""
  if (labels.length === 1) return labels[0]
  const joiner = lang === "es" ? " y " : " and "
  return `${labels.slice(0, -1).join(", ")}${joiner}${labels[labels.length - 1]}`
}

function categoryLabel(id: PoiCategoryId, lang: Lang): string {
  const txt = uiText[lang]
  const labels: Record<PoiCategoryId, string> = {
    education: txt.nearbyAmenitiesCategoryEducation.toLowerCase(),
    health: txt.nearbyAmenitiesCategoryHealth.toLowerCase(),
    food: txt.nearbyAmenitiesCategoryFood.toLowerCase(),
    groceries: txt.nearbyAmenitiesCategoryGroceries.toLowerCase(),
    sports: txt.nearbyAmenitiesCategorySports.toLowerCase(),
    parks: txt.nearbyAmenitiesCategoryParks.toLowerCase(),
    services: txt.nearbyAmenitiesCategoryServices.toLowerCase(),
    transit: txt.nearbyAmenitiesCategoryTransit.toLowerCase(),
  }
  return labels[id]
}

function subTypeFallback(subType: string, lang: Lang): string {
  const txt = uiText[lang]
  const labels: Record<string, string> = {
    school: txt.nearbyAmenitiesSubTypeSchool,
    kindergarten: txt.nearbyAmenitiesSubTypeKindergarten,
    university: txt.nearbyAmenitiesSubTypeUniversity,
    college: txt.nearbyAmenitiesSubTypeCollege,
    hospital: txt.nearbyAmenitiesSubTypeHospital,
    clinic: txt.nearbyAmenitiesSubTypeClinic,
    doctors: txt.nearbyAmenitiesSubTypeDoctors,
    pharmacy: txt.nearbyAmenitiesSubTypePharmacy,
    restaurant: txt.nearbyAmenitiesSubTypeRestaurant,
    cafe: txt.nearbyAmenitiesSubTypeCafe,
    fast_food: txt.nearbyAmenitiesSubTypeFastFood,
    bar: txt.nearbyAmenitiesSubTypeBar,
    supermarket: txt.nearbyAmenitiesSubTypeSupermarket,
    convenience: txt.nearbyAmenitiesSubTypeConvenience,
    grocery: txt.nearbyAmenitiesSubTypeGrocery,
    mall: txt.nearbyAmenitiesSubTypeMall,
    clothes: txt.nearbyAmenitiesSubTypeClothes,
    bakery: txt.nearbyAmenitiesSubTypeBakery,
    marketplace: txt.nearbyAmenitiesSubTypeMarketplace,
    fitness_centre: txt.nearbyAmenitiesSubTypeFitnessCentre,
    sports_centre: txt.nearbyAmenitiesSubTypeSportsCentre,
    swimming_pool: txt.nearbyAmenitiesSubTypeSwimmingPool,
    pitch: txt.nearbyAmenitiesSubTypePitch,
    park: txt.nearbyAmenitiesSubTypePark,
    playground: txt.nearbyAmenitiesSubTypePlayground,
    bank: txt.nearbyAmenitiesSubTypeBank,
    atm: txt.nearbyAmenitiesSubTypeAtm,
    bus_stop: txt.nearbyAmenitiesSubTypeBusStop,
    bus_station: txt.nearbyAmenitiesSubTypeBusStation,
    station: txt.nearbyAmenitiesSubTypeStation,
    halt: txt.nearbyAmenitiesSubTypeHalt,
    stop_position: txt.nearbyAmenitiesSubTypeStop,
  }
  return labels[subType] ?? txt.nearbyAmenitiesUnnamed
}

type NearbyHighlight = {
  name: string
  distanceM: number
  categoryId: PoiCategoryId
  subType: string | null
}

function nearestByCategory(
  nearby: NearbyAmenitiesResult,
): Map<PoiCategoryId, NearbyHighlight> {
  const byCategory = new Map<PoiCategoryId, NearbyHighlight>()

  for (const category of nearby.categories) {
    if (category.count <= 0 || category.places.length === 0) continue
    const nearest = [...category.places].sort((a, b) => a.distanceM - b.distanceM)[0]
    if (!nearest) continue
    byCategory.set(category.id, {
      name: nearest.name?.trim() || "",
      distanceM: nearest.distanceM,
      categoryId: category.id,
      subType: nearest.subType,
    })
  }

  return byCategory
}

function pickNearbyHighlights(nearby: NearbyAmenitiesResult): NearbyHighlight[] {
  const byCategory = nearestByCategory(nearby)

  const named: NearbyHighlight[] = []
  for (const id of CATEGORY_PRIORITY) {
    const hit = byCategory.get(id)
    if (!hit?.name) continue
    named.push(hit)
    if (named.length >= 2) return named
  }
  if (named.length > 0) return named

  const fallback: NearbyHighlight[] = []
  for (const id of CATEGORY_PRIORITY) {
    const hit = byCategory.get(id)
    if (!hit) continue
    fallback.push(hit)
    if (fallback.length >= 2) break
  }
  return fallback
}

function highlightLabel(h: NearbyHighlight, lang: Lang): string {
  if (h.name) return h.name
  if (h.subType) return subTypeFallback(h.subType, lang)
  return categoryLabel(h.categoryId, lang)
}

function nearbyPoolForCategory(
  id: PoiCategoryId,
  copy: (typeof narrativeCopy)[Lang],
): readonly string[] {
  if (id === "parks") return copy.nearbyPark
  if (id === "groceries") return copy.nearbyGrocery
  if (id === "food") return copy.nearbyFood
  if (id === "sports") return copy.nearbySports
  if (id === "services") return copy.nearbyServices
  if (id === "transit") return copy.nearbyTransit
  if (id === "education") return copy.nearbyEducation
  return copy.nearbyHealth
}

function walkPartTemplate(
  id: PoiCategoryId,
  copy: (typeof narrativeCopy)[Lang],
): string {
  if (id === "education") return copy.walkPartEducation[0]!
  if (id === "health") return copy.walkPartHealth[0]!
  if (id === "groceries") return copy.walkPartGroceries[0]!
  if (id === "parks") return copy.walkPartParks[0]!
  return copy.walkPartTransit[0]!
}

/** Full walking-distance paragraph when several amenity categories are present. */
function walkDistanceParagraph(
  nearby: NearbyAmenitiesResult,
  lang: Lang,
  locale: string,
  seed: number,
): string | null {
  const copy = narrativeCopy[lang]
  const byCategory = nearestByCategory(nearby)
  const present = WALK_CATEGORY_PRIORITY.filter((id) => byCategory.has(id))
  if (present.length < 3) return null

  const intro = pickVariant(copy.walkIntro, seed, 11)

  if (present.length >= WALK_FULL_MIN_CATEGORIES && byCategory.size >= 4) {
    const distVars: Record<string, string> = {
      education: "—",
      health: "—",
      groceries: "—",
      parks: "—",
      transit: "—",
    }
    for (const id of WALK_CATEGORY_PRIORITY) {
      const hit = byCategory.get(id)
      if (hit) distVars[id] = formatDistanceM(hit.distanceM, locale)
    }
    // Only use full body when we have all five walk categories, else partial.
    if (WALK_CATEGORY_PRIORITY.every((id) => byCategory.has(id))) {
      return `${intro} ${fill(pickVariant(copy.walkBody, seed, 13), distVars)}`
    }
  }

  const parts = present.map((id) => {
    const hit = byCategory.get(id)!
    return fill(walkPartTemplate(id, copy), {
      dist: formatDistanceM(hit.distanceM, locale),
    })
  })

  return `${intro} ${fill(pickVariant(copy.walkBodyPartial, seed, 13), {
    parts: joinList(parts, lang),
  })}`
}

function nearbySentence(
  nearby: NearbyAmenitiesResult | null,
  lang: Lang,
  locale: string,
  seed: number,
): string | null {
  if (!nearby || nearby.unavailable) return null

  const walk = walkDistanceParagraph(nearby, lang, locale, seed)
  if (walk) return walk

  const copy = narrativeCopy[lang]
  const highlights = pickNearbyHighlights(nearby)

  if (highlights.length >= 2) {
    return fill(pickVariant(copy.nearbyTwo, seed, 11), {
      place1: highlightLabel(highlights[0]!, lang),
      dist1: formatDistanceM(highlights[0]!.distanceM, locale),
      place2: highlightLabel(highlights[1]!, lang),
      dist2: formatDistanceM(highlights[1]!.distanceM, locale),
    })
  }

  if (highlights.length === 1) {
    const h = highlights[0]!
    return fill(pickVariant(nearbyPoolForCategory(h.categoryId, copy), seed, 13), {
      place: highlightLabel(h, lang),
      dist: formatDistanceM(h.distanceM, locale),
    })
  }

  const activeCategories = CATEGORY_PRIORITY.filter((id) =>
    nearby.categories.some((c) => c.id === id && c.count > 0),
  ).map((id) => categoryLabel(id, lang))

  if (activeCategories.length === 0) return null
  return fill(pickVariant(copy.nearbyCategories, seed, 17), {
    categories: joinList(activeCategories.slice(0, 3), lang),
  })
}

/**
 * Deterministic multi-sentence summary — template NLG with per-listing variant picks.
 */
export function buildListingNarrative(input: ListingNarrativeInput): string {
  const copy = narrativeCopy[input.lang]
  const seed = hashSeed(input.listingId || `${input.city}:${input.neighborhood}:${input.areaM2}`)
  const typeLabel = propertyTypeLabel(input.propertyType, input.lang).toLowerCase()
  const place = placeLine(input.city, input.neighborhood)
  const area =
    Number.isFinite(input.areaM2) && input.areaM2 > 0
      ? input.areaM2.toFixed(input.areaM2 >= 10 ? 0 : 1)
      : "—"
  const pct =
    input.discountVsRefPct != null && Number.isFinite(input.discountVsRefPct)
      ? Math.abs(input.discountVsRefPct).toFixed(1)
      : null

  const insufficient =
    input.sampleSize <= 0 ||
    input.referencePpm2 == null ||
    !Number.isFinite(input.referencePpm2) ||
    input.referencePpm2 <= 0

  const sentences: string[] = []
  const leadVars = { type: typeLabel, area, place, pct: pct ?? "0" }

  if (insufficient) {
    sentences.push(fill(pickVariant(copy.leadInsufficient, seed, 1), leadVars))
  } else {
    const leadPool =
      input.verdict === "good_deal" && pct
        ? copy.leadGood
        : input.verdict === "overpriced" && pct
          ? copy.leadOver
          : copy.leadFair
    sentences.push(fill(pickVariant(leadPool, seed, 1), leadVars))

    const supportRoll = seed % 3
    const method = compMethodLabel(input.compMethod ?? undefined, input.lang)
    const count = String(input.sampleSize)
    const supportPool =
      input.confidence === "high"
        ? copy.supportHigh
        : input.confidence === "medium"
          ? copy.supportMedium
          : copy.supportLow

    if (supportRoll !== 0 || input.confidence === "low") {
      sentences.push(fill(pickVariant(supportPool, seed, 3), { count, method }))
    }
  }

  const hasBeds =
    input.bedrooms != null &&
    Number.isFinite(input.bedrooms) &&
    input.bedrooms > 0 &&
    input.bathrooms != null &&
    Number.isFinite(input.bathrooms) &&
    input.bathrooms > 0

  if (hasBeds && seed % 2 === 0) {
    const estratoPart =
      input.estrato != null && Number.isFinite(input.estrato)
        ? `, estrato ${input.estrato}`
        : ""
    sentences.push(
      fill(pickVariant(copy.snapshotBeds, seed, 5), {
        beds: String(input.bedrooms),
        baths: String(input.bathrooms),
        estratoPart,
      }),
    )
  } else if (
    input.estrato != null &&
    Number.isFinite(input.estrato) &&
    seed % 3 === 1
  ) {
    sentences.push(
      fill(pickVariant(copy.snapshotEstrato, seed, 5), {
        estrato: String(input.estrato),
        place,
      }),
    )
  }

  const facilityLabels = listFacilities(input.facilities, 4)
  if (facilityLabels.length > 0) {
    sentences.push(
      fill(pickVariant(copy.buildingAmenities, seed, 19), {
        amenities: joinList(facilityLabels, input.lang),
      }),
    )
  }

  if (
    input.priceDropPct != null &&
    Number.isFinite(input.priceDropPct) &&
    input.priceDropPct > 0
  ) {
    sentences.push(
      fill(pickVariant(copy.priceDrop, seed, 7), {
        pct: input.priceDropPct.toFixed(1),
      }),
    )
  } else if (
    input.domDays != null &&
    Number.isFinite(input.domDays) &&
    input.domDays >= LONG_DOM_DAYS
  ) {
    sentences.push(
      fill(pickVariant(copy.longDom, seed, 7), {
        days: String(Math.round(input.domDays)),
      }),
    )
  }

  const around = nearbySentence(input.nearby, input.lang, input.locale, seed)
  if (around) {
    if (!insufficient && seed % 4 === 0 && sentences.length >= 1) {
      sentences.splice(1, 0, around)
    } else {
      sentences.push(around)
    }
  }

  return sentences.join(" ")
}
