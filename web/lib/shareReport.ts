import { randomBytes } from "crypto"

import type { DealReview, DealVerdict } from "@/lib/dealReview"
import type { Lang } from "@/lib/i18n"

export type SharedAnalyzePayload = {
  listing: {
    title: string
    url: string
    city: string
    neighborhood: string | null
    propertyType: string | null
    operationType: string | null
    priceCop: string
    areaM2: number
    areaBuiltM2?: number | null
    areaPrivateM2?: number | null
    areaTerrainM2?: number | null
    areaTerraceM2?: number | null
    estrato: number | null
    bedrooms?: number | null
    bathrooms?: number | null
    garage?: number | null
    pricePerM2: number | null
    constructionState?: string | null
    facilities?: unknown
    latitude?: number | null
    longitude?: number | null
  }
  analysis: {
    dealScore: number | null
    verdict: DealVerdict
    review?: DealReview
    confidence: "high" | "medium" | "low"
    warnings: string[]
    discountVsRefPct: number | null
    referencePpm2: number | null
    referencePpm2Nearby?: number | null
    referencePpm2Neighborhood?: number | null
    sampleSize: number
    compMethod?: string
    metricType?: string
    whyDeal?: unknown
    domDays?: number | null
    priceDropPct?: number | null
  }
  priceTimeline?: Array<{ recordedAt: string; priceCop: string }>
  comps: Array<{
    id: string
    title: string
    city: string
    neighborhood: string | null
    priceCop: string
    areaM2: number
    pricePerM2: number | null
    distanceMeters: number | null
    url: string
  }>
}

export const createReportSlug = (): string => {
  return randomBytes(12).toString("base64url")
}

export const isSharedAnalyzePayload = (value: unknown): value is SharedAnalyzePayload => {
  if (!value || typeof value !== "object") return false
  const v = value as SharedAnalyzePayload
  return (
    typeof v.listing?.title === "string" &&
    typeof v.listing?.url === "string" &&
    typeof v.analysis?.verdict === "string"
  )
}

export const sharedReportPath = (slug: string): string => `/r/${slug}`

export const whatsAppShareUrl = (text: string): string =>
  `https://wa.me/?text=${encodeURIComponent(text)}`

export const buildShareMessage = (
  payload: SharedAnalyzePayload,
  reportUrl: string,
  lang: Lang,
): string => {
  const verdictLabel =
    payload.analysis.verdict === "good_deal"
      ? lang === "es"
        ? "Buena oportunidad"
        : "Good deal"
      : payload.analysis.verdict === "review"
        ? lang === "es"
          ? "Revisar antes de confiar"
          : "Check before trusting"
      : payload.analysis.verdict === "overpriced"
        ? lang === "es"
          ? "Caro para el barrio"
          : "Overpriced"
        : lang === "es"
          ? "Precio justo"
          : "Fair price"

  const discount =
    payload.analysis.discountVsRefPct != null
      ? `${payload.analysis.discountVsRefPct.toFixed(1)}%`
      : "—"

  if (lang === "es") {
    return `Análisis LupaCasa: ${payload.listing.title}\nVeredicto: ${verdictLabel} (${discount} vs referencia)\n${reportUrl}`
  }
  return `LupaCasa analysis: ${payload.listing.title}\nVerdict: ${verdictLabel} (${discount} vs reference)\n${reportUrl}`
}
