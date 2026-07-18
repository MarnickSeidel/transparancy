import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const H3Heatmap = loadToolPage(() => import("@/app/components/H3Heatmap"))

export const metadata: Metadata = noIndexMetadata(
  "Mapa de calor H3",
  "Visualización interactiva de precio/m² por hexágono.",
)

export default function HeatmapPage() {
  return <H3Heatmap />
}
