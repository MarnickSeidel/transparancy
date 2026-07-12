import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

const OpportunitiesTop = dynamic(() => import("@/app/components/OpportunitiesTop"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Oportunidades inmobiliarias",
  "Ranking de publicaciones con mejor descuento relativo — herramienta Habidata.",
);

export default function OpportunitiesPage() {
  return <OpportunitiesTop />;
}
