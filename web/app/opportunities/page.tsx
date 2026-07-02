import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const OpportunitiesTop = dynamic(() => import("@/app/components/OpportunitiesTop"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function OpportunitiesPage() {
  return <OpportunitiesTop />;
}
