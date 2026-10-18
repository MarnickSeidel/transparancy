import type { Metadata } from "next"

import SharedReportPageClient from "@/app/r/[slug]/SharedReportPageClient"
import { pageTitle } from "@/lib/seo"

type Props = { params: { slug: string } }

export const metadata: Metadata = {
  title: pageTitle("Informe CasasClaras"),
  description: "Análisis compartido de precio por m² vs comparables.",
  robots: { index: false, follow: false },
}

export default function SharedReportPage({ params }: Props) {
  return <SharedReportPageClient slug={params.slug} />
}
