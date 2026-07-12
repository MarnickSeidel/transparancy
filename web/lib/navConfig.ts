export type NavKey =
  | "dashboard"
  | "estimate"
  | "opportunities"
  | "explore"
  | "zones"
  | "heatmap"
  | "analyzeUrl"
  | "priceDrops"

export type NavTextKey =
  | "dashboardNav"
  | "estimateNav"
  | "opportunitiesNav"
  | "exploreNav"
  | "zonesNav"
  | "heatmapNav"
  | "analyzeUrlNav"
  | "priceDropsNav"

export type NavGroupId = "research" | "analyze" | "market"

export type NavGroup = {
  id: NavGroupId
  labelKey: "navGroupResearch" | "navGroupAnalyze" | "navGroupMarket"
  items: Array<{ key: NavKey; href: string; textKey: NavTextKey; primary?: boolean }>
}

/** Grouped navigation — two primary journeys with supporting tools */
export const navGroups: NavGroup[] = [
  {
    id: "research",
    labelKey: "navGroupResearch",
    items: [
      { key: "zones", href: "/zones", textKey: "zonesNav", primary: true },
      { key: "explore", href: "/explore", textKey: "exploreNav" },
    ],
  },
  {
    id: "analyze",
    labelKey: "navGroupAnalyze",
    items: [
      { key: "analyzeUrl", href: "/analyze-url", textKey: "analyzeUrlNav", primary: true },
      { key: "estimate", href: "/estimate", textKey: "estimateNav" },
    ],
  },
  {
    id: "market",
    labelKey: "navGroupMarket",
    items: [
      { key: "dashboard", href: "/dashboard", textKey: "dashboardNav" },
      { key: "heatmap", href: "/heatmap", textKey: "heatmapNav" },
      { key: "opportunities", href: "/opportunities", textKey: "opportunitiesNav" },
      { key: "priceDrops", href: "/price-drops", textKey: "priceDropsNav" },
    ],
  },
]

/** Flat list for backward compatibility */
export const navItems = navGroups.flatMap((g) => g.items)

export const primaryNavHrefs = navGroups
  .flatMap((g) => g.items.filter((i) => i.primary))
  .map((i) => i.href)
