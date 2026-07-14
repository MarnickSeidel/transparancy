import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const ListingExplorer = loadToolPage(
  () => import("@/app/components/ListingExplorer"),
)

export const metadata: Metadata = noIndexMetadata(
  "Explorador de publicaciones",
  "Herramienta interna para filtrar publicaciones Finca Raíz.",
)

export default function ExplorePage() {
  return <ListingExplorer />
}
