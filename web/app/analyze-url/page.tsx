import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const AnalyzeUrlForm = loadToolPage(
  () => import("@/app/components/AnalyzeUrlForm"),
)

export const metadata: Metadata = noIndexMetadata(
  "Analizar anuncio por URL",
  "Diagnóstico de precio para un anuncio Finca Raíz.",
)

export default function AnalyzeUrlPage() {
  return <AnalyzeUrlForm />
}
