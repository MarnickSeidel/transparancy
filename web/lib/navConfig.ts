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

export type NavItem = {
  key: NavKey
  href: string
  textKey: NavTextKey
}

/** Three primary journeys — visible in the main nav bar */
export const primaryNavItems: NavItem[] = [
  { key: "zones", href: "/zones", textKey: "zonesNav" },
  { key: "analyzeUrl", href: "/analizar-anuncio", textKey: "analyzeUrlNav" },
  { key: "opportunities", href: "/oportunidades", textKey: "opportunitiesNav" },
]

/** Supporting tools — under “More” */
export const moreNavItems: NavItem[] = [
  { key: "explore", href: "/explore", textKey: "exploreNav" },
  { key: "estimate", href: "/cuanto-vale-mi-casa", textKey: "estimateNav" },
  { key: "heatmap", href: "/heatmap", textKey: "heatmapNav" },
  { key: "priceDrops", href: "/price-drops", textKey: "priceDropsNav" },
  { key: "dashboard", href: "/dashboard", textKey: "dashboardNav" },
]

export const navItems: NavItem[] = [...primaryNavItems, ...moreNavItems]

export const primaryNavHrefs = primaryNavItems.map((item) => item.href)
