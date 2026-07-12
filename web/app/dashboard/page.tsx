import type { Metadata } from "next";
import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";
import { noIndexMetadata } from "@/lib/seo";

const Dashboard = dynamic(() => import("@/app/components/Dashboard"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export const metadata: Metadata = noIndexMetadata(
  "Dashboard de mercado",
  "Panel interno de analítica inmobiliaria Habidata.",
);

export default function DashboardPage() {
  return <Dashboard />;
}
