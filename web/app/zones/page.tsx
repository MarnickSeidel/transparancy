import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const ZonesIndex = dynamic(() => import("@/app/components/ZonesIndex"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function ZonesPage() {
  return <ZonesIndex />;
}
