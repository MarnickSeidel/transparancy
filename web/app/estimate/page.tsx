import type { Metadata } from "next"

import EstimateForm from "@/app/components/EstimateForm"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata(
  "Estimador de precio",
  "Calculadora de rango de precio basada en publicaciones activas.",
)

export default function EstimatePage() {
  return <EstimateForm />
}
