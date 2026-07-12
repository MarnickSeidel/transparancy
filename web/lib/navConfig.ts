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
  { key: "dashboard", href: "/dashboard", textKey: "dashboardNav" },
  { key: "opportunities", href: "/opportunities", textKey: "opportunitiesNav" },
  { key: "explore", href: "/explore", textKey: "exploreNav" },
  { key: "zones", href: "/zones", textKey: "zonesNav" },
  { key: "heatmap", href: "/heatmap", textKey: "heatmapNav" },
  { key: "analyzeUrl", href: "/analyze-url", textKey: "analyzeUrlNav" },
  { key: "estimate", href: "/estimate", textKey: "estimateNav" },
]
