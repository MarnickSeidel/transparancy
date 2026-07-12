import type { Metadata } from "next";

import AnalyzeUrlForm from "@/app/components/AnalyzeUrlForm";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata(
  "Analizar anuncio por URL",
  "Diagnóstico de precio para un anuncio Finca Raíz.",
);

export default function AnalyzeUrlPage() {
  return <AnalyzeUrlForm />;
}
