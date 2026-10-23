import type { DealReview } from "@/lib/dealReview"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

export function dealReviewLabels(review: DealReview | null | undefined, lang: Lang): string[] {
  if (!review?.needsReview) return []
  const txt = uiText[lang]
  return review.reasons.map((reason) => {
    if (reason === "cross_barrio_comps" && review.compBarrio && review.compBarrioShare != null) {
      return txt.reviewReason_cross_barrio_named
        .replace("{pct}", String(Math.round(review.compBarrioShare * 100)))
        .replace("{barrio}", review.compBarrio)
    }
    if (reason === "extreme_discount") return txt.reviewReason_extreme_discount
    if (reason === "city_wide_comps") return txt.reviewReason_city_wide_comps
    if (reason === "unknown_barrio") return txt.reviewReason_unknown_barrio
    return txt.reviewReason_cross_barrio_comps
  })
}

export function dealWarningLabel(
  note: string,
  lang: Lang,
): string {
  const txt = uiText[lang]
  const key = `dealNote_${note}` as keyof typeof txt
  const fromNote = txt[key] as string | undefined
  if (fromNote) return fromNote
  const flagKey = `dealFlag_${note}` as keyof typeof txt
  const fromFlag = txt[flagKey] as string | undefined
  if (fromFlag) return fromFlag
  return note.replace(/_/g, " ")
}

export function compMethodLabel(method: string | undefined, lang: Lang): string {
  if (!method) return "—"
  const labels: Record<string, { es: string; en: string }> = {
    geo_1km: { es: "radio 1 km", en: "1 km radius" },
    zone: { es: "zona", en: "zone" },
    neighborhood: { es: "barrio", en: "neighborhood" },
    city: { es: "ciudad", en: "city" },
    none: { es: "sin mercado", en: "no market" },
  }
  return labels[method]?.[lang] ?? method
}

export function metricTypeLabel(
  metricType: string | undefined,
  lang: Lang,
): string {
  const txt = uiText[lang]
  if (metricType === "private") return txt.opportunitiesMetricPrivate
  if (metricType === "built") return txt.opportunitiesMetricBuilt
  if (metricType === "terrain") return txt.opportunitiesMetricTerrain
  return txt.opportunitiesMetricGeneric
}

export function confidenceLabel(
  confidence: "high" | "medium" | "low" | undefined,
  lang: Lang,
): string {
  const txt = uiText[lang]
  if (confidence === "high") return txt.confidenceHigh
  if (confidence === "medium") return txt.confidenceMedium
  if (confidence === "low") return txt.confidenceLow
  return "—"
}
