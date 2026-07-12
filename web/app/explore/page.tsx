import type { Metadata } from "next";

import ListingExplorer from "@/app/components/ListingExplorer";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata(
  "Explorador de publicaciones",
  "Herramienta interna para filtrar publicaciones Finca Raíz.",
);

export default function ExplorePage() {
  return <ListingExplorer />;
}
