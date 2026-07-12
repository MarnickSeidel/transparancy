import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

const H3Heatmap = dynamic(() => import("@/app/components/H3Heatmap"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Mapa de calor H3",
  "Visualización interactiva de precio/m² por hexágono.",
);

export default function HeatmapPage() {
  return <H3Heatmap />;
}
