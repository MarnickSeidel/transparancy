import type { Metadata } from "next"

import PriceDropsFeed from "@/app/components/PriceDropsFeed"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata(
  "Bajadas de precio",
  "Publicaciones con reducción reciente de precio de pedido en Finca Raíz.",
)

export default function PriceDropsPage() {
  return <PriceDropsFeed />
}
