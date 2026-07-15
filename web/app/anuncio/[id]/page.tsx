import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import ListingDetailView from "@/app/components/ListingDetailView"
import { getListingDetail } from "@/lib/getListingDetail"
import { type Locale } from "@/lib/locale"
import { noIndexMetadata } from "@/lib/seo"

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getListingDetail(params.id)
  if (!detail) {
    return noIndexMetadata("Anuncio no encontrado", "Este anuncio no esta disponible.")
  }

  const locale = (headers().get("x-locale") as Locale | null) ?? "es"
  const description =
    locale === "en"
      ? `Deal score ${detail.analysis.dealScore?.toFixed(1) ?? "—"} vs neighborhood benchmarks — ClaraCasas.`
      : `Puntaje ${detail.analysis.dealScore?.toFixed(1) ?? "—"} frente al mercado del barrio — ClaraCasas.`

  return noIndexMetadata(detail.listing.title, description)
}

export default async function ListingDetailPage({ params }: Props) {
  const detail = await getListingDetail(params.id)
  if (!detail) notFound()

  const locale = (headers().get("x-locale") as Locale | null) ?? "es"

  return <ListingDetailView data={detail} pageLocale={locale} />
}
