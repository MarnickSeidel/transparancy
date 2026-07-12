export type NavKey =
  | "dashboard"
  | "estimate"
  | "opportunities"
  | "explore"
  | "zones"
  | "heatmap"
  | "analyzeUrl"

export type NavTextKey =
  | "dashboardNav"
  | "estimateNav"
  | "opportunitiesNav"
  | "exploreNav"
  | "zonesNav"
  | "heatmapNav"
  | "analyzeUrlNav"

export const navItems: Array<{ key: NavKey; href: string; textKey: NavTextKey }> = [
  { key: "zones", href: "/zones", textKey: "zonesNav" },
  { key: "explore", href: "/explore", textKey: "exploreNav" },
  { key: "opportunities", href: "/opportunities", textKey: "opportunitiesNav" },
  { key: "dashboard", href: "/dashboard", textKey: "dashboardNav" },
  { key: "heatmap", href: "/heatmap", textKey: "heatmapNav" },
  { key: "analyzeUrl", href: "/analyze-url", textKey: "analyzeUrlNav" },
  { key: "estimate", href: "/estimate", textKey: "estimateNav" },
]
