import type { Metadata } from "next"

import H3Heatmap from "@/app/components/H3Heatmap"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata(
  "Mapa de calor H3",
  "Visualización interactiva de precio/m² por hexágono.",
)

export default function HeatmapPage() {
  return <H3Heatmap />
}
