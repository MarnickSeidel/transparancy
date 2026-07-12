import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

/** Client-only: map + form avoid SSR/hydration issues and Strict Mode Leaflet crashes. */
const EstimateForm = dynamic(() => import("@/app/components/EstimateForm"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Estimador de precio",
  "Calculadora de rango de precio basada en publicaciones activas.",
);

export default function EstimatePage() {
  return <EstimateForm />;
}
