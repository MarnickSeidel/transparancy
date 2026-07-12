import type { Metadata } from "next";

import OpportunitiesTop from "@/app/components/OpportunitiesTop";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata(
  "Oportunidades inmobiliarias",
  "Ranking de publicaciones con mejor descuento relativo — herramienta Habidata.",
);

export default function OpportunitiesPage() {
  return <OpportunitiesTop />;
}
