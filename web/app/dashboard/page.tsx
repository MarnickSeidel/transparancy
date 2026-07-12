import type { Metadata } from "next";

import Dashboard from "@/app/components/Dashboard";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = noIndexMetadata(
  "Dashboard de mercado",
  "Panel interno de analítica inmobiliaria Habidata.",
);

export default function DashboardPage() {
  return <Dashboard />;
}
