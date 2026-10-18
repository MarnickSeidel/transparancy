"use client"

import Card from "@/app/components/ui/Card"
import { buildListingNarrative } from "@/lib/buildListingNarrative"
import type { DealVerdict } from "@/lib/dealReview"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import type { NearbyAmenitiesResult } from "@/lib/nearbyAmenities"

type Verdict = DealVerdict
type Confidence = "high" | "medium" | "low"

type Props = {
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
  verdict: Verdict
  confidence: Confidence
  discountVsRefPct: number | null
  sampleSize: number
  referencePpm2: number | null
  compMethod: string | null
  compBarrio?: string | null
  priceDropPct: number | null
  domDays: number | null
  nearby: NearbyAmenitiesResult | null
  nearbyLoading?: boolean
}

export default function ListingNarrativeCard(props: Props) {
  const txt = uiText[props.lang]
  const narrative = buildListingNarrative({
    listingId: props.listingId,
    lang: props.lang,
    locale: props.locale,
    city: props.city,
    neighborhood: props.neighborhood,
    propertyType: props.propertyType,
    areaM2: props.areaM2,
    estrato: props.estrato,
    bedrooms: props.bedrooms,
    bathrooms: props.bathrooms,
    facilities: props.facilities,
    verdict: props.verdict,
    confidence: props.confidence,
    discountVsRefPct: props.discountVsRefPct,
    sampleSize: props.sampleSize,
    referencePpm2: props.referencePpm2,
    compMethod: props.compMethod,
    compBarrio: props.compBarrio ?? null,
    priceDropPct: props.priceDropPct,
    domDays: props.domDays,
    nearby: props.nearbyLoading ? null : props.nearby,
  })

  return (
    <Card className="border-slate-200/90 shadow-card">
      <h2 className="text-sm font-semibold text-foreground">{txt.listingNarrativeTitle}</h2>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{narrative}</p>
    </Card>
  )
}
