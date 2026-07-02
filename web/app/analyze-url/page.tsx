import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const AnalyzeUrlForm = dynamic(() => import("@/app/components/AnalyzeUrlForm"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function AnalyzeUrlPage() {
  return <AnalyzeUrlForm />;
}
