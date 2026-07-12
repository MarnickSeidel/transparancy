import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

const ListingExplorer = dynamic(() => import("@/app/components/ListingExplorer"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Explorador de publicaciones",
  "Herramienta interna para filtrar publicaciones Finca Raíz.",
);

export default function ExplorePage() {
  return <ListingExplorer />;
}
