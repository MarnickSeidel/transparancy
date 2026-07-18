import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const PriceDropsFeed = loadToolPage(
  () => import("@/app/components/PriceDropsFeed"),
)

export const metadata: Metadata = noIndexMetadata(
  "Bajadas de precio",
  "Publicaciones con reducción reciente de precio de pedido en Finca Raíz.",
)

export default function PriceDropsPage() {
  return <PriceDropsFeed />
}
