import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

const AnalyzeUrlForm = dynamic(() => import("@/app/components/AnalyzeUrlForm"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Analizar anuncio por URL",
  "Diagnóstico de precio para un anuncio Finca Raíz.",
);

export default function AnalyzeUrlPage() {
  return <AnalyzeUrlForm />;
}
