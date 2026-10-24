import { normalizeNeighborhoodKey } from "@/lib/neighborhoods"

/** Above this discount vs comps the gap is more likely data than a bargain. */
export const REVIEW_DISCOUNT_PCT = 50
/** Share of comps in one other barrio that makes the reference borrowed. */
export const CROSS_BARRIO_COMP_SHARE = 0.5
/** Home page features only discounts in this band with a matched barrio and photo. */
export const FEATURED_MAX_DISCOUNT_PCT = 40

export type DealVerdict = "good_deal" | "review" | "fair" | "overpriced"

export type DealReviewReason =
  | "extreme_discount"
  | "city_wide_comps"
  | "cross_barrio_comps"
  | "unknown_barrio"

export type DealReview = {
  needsReview: boolean
  reasons: DealReviewReason[]
  /** Most common comp barrio when it differs from the subject's. */
  compBarrio: string | null
  compBarrioShare: number | null
}

type CompLocation = { neighborhood: string | null; zoneName: string | null }

const keyOf = (value: string | null | undefined): string => {
  const trimmed = value?.trim()
  return trimmed ? normalizeNeighborhoodKey(trimmed) : ""
}

const compMatchesSubject = (subjectKeys: Set<string>, comp: CompLocation): boolean => {
  const nk = keyOf(comp.neighborhood)
  const zk = keyOf(comp.zoneName)
  return (nk !== "" && subjectKeys.has(nk)) || (zk !== "" && subjectKeys.has(zk))
}

export const buildDealReview = (args: {
  discountPct: number | null
  compMethod: string | null
  city: string | null
  subjectNeighborhood: string | null
  subjectZoneName: string | null
  comps: CompLocation[]
}): DealReview => {
  const reasons: DealReviewReason[] = []
  const discount = args.discountPct

  if (discount != null && Number.isFinite(discount) && discount > REVIEW_DISCOUNT_PCT) {
    reasons.push("extreme_discount")
  }
  if (args.compMethod === "city") reasons.push("city_wide_comps")

  const cityKey = keyOf(args.city)
  const subjectKeys = new Set(
    [keyOf(args.subjectNeighborhood), keyOf(args.subjectZoneName)].filter(
      (k) => k !== "" && k !== cityKey,
    ),
  )
  if (subjectKeys.size === 0) reasons.push("unknown_barrio")

  let compBarrio: string | null = null
  let compBarrioShare: number | null = null

  if (subjectKeys.size > 0 && args.comps.length > 0) {
    const counts = new Map<string, { label: string; count: number }>()
    for (const c of args.comps) {
      if (compMatchesSubject(subjectKeys, c)) continue
      const label = c.neighborhood?.trim() || c.zoneName?.trim()
      if (!label) continue
      const k = keyOf(label)
      const entry = counts.get(k) ?? { label, count: 0 }
      entry.count += 1
      counts.set(k, entry)
    }
    const top = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]
    if (top && top.count / args.comps.length > CROSS_BARRIO_COMP_SHARE) {
      reasons.push("cross_barrio_comps")
      compBarrio = top.label
      compBarrioShare = top.count / args.comps.length
    }
  }

  return {
    needsReview: reasons.length > 0,
    reasons,
    compBarrio,
    compBarrioShare,
  }
}

/** Opportunities never list these: the reference is not the listing's own barrio. */
export const hasBorrowedReference = (review: DealReview): boolean =>
  review.reasons.includes("unknown_barrio") || review.reasons.includes("cross_barrio_comps")

/** True when a deal is clean enough to promote on the home page. */
export const isFeaturableDeal = (row: {
  review: DealReview
  imageUrl: string | null
  discountVsRefPct: number | null
}): boolean =>
  !row.review.needsReview &&
  Boolean(row.imageUrl) &&
  row.discountVsRefPct != null &&
  row.discountVsRefPct <= FEATURED_MAX_DISCOUNT_PCT
