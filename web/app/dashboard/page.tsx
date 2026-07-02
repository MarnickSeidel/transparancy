import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const Dashboard = dynamic(() => import("@/app/components/Dashboard"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function DashboardPage() {
  return <Dashboard />;
}
