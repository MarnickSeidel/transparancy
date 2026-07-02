import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

/** Client-only: map + form avoid SSR/hydration issues and Strict Mode Leaflet crashes. */
const EstimateForm = dynamic(() => import("@/app/components/EstimateForm"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function EstimatePage() {
  return <EstimateForm />;
}
