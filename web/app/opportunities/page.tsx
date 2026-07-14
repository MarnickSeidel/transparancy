import type { Metadata } from "next"
import { headers } from "next/headers"

import OpportunitiesTop from "@/app/components/OpportunitiesTop"
import { type Locale } from "@/lib/locale"
import { opportunitiesJsonLd } from "@/lib/opportunitiesSeo"
import { opportunitiesMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (headers().get("x-locale") as Locale | null) ?? "es"
  return opportunitiesMetadata(locale)
}

export default function OpportunitiesPage() {
  const locale = (headers().get("x-locale") as Locale | null) ?? "es"
  const jsonLd = opportunitiesJsonLd(locale)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OpportunitiesTop />
    </>
  )
}
