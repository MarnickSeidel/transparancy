import type { Metadata } from "next"

import { loadToolPage } from "@/lib/loadToolPage"
import { noIndexMetadata } from "@/lib/seo"

const Dashboard = loadToolPage(() => import("@/app/components/Dashboard"))

export const metadata: Metadata = noIndexMetadata(
  "Dashboard de mercado",
  "Panel interno de analítica inmobiliaria LupaCasa.",
)

export default function DashboardPage() {
  return <Dashboard />
}
