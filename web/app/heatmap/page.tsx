import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const H3Heatmap = dynamic(() => import("@/app/components/H3Heatmap"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function HeatmapPage() {
  return <H3Heatmap />;
}
