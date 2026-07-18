import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const EstimateForm = loadToolPage(() => import("@/app/components/EstimateForm"))

export const metadata: Metadata = noIndexMetadata(
  "Estimador de precio",
  "Calculadora de rango de precio basada en publicaciones activas.",
)

export default function EstimatePage() {
  return <EstimateForm />
}
