import { analyze } from "./analyze"
import { common } from "./common"
import { dashboard } from "./dashboard"
import { estimate } from "./estimate"
import { explore } from "./explore"
import { heatmap } from "./heatmap"
import { listing } from "./listing"
import { nearby } from "./nearby"
import { nextSteps } from "./nextSteps"
import { opportunities } from "./opportunities"
import { priceDrops } from "./priceDrops"
import { share } from "./share"
import { subscribe } from "./subscribe"
import { zones } from "./zones"

export type Lang = "es" | "en"

export const priorityCities = [
  "Pereira",
  "Medellin",
  "Bogota",
  "Cali",
  "Manizales",
]

/** Merged UI strings. Prefer editing the domain file under `lib/i18n/` for the keys you touch. */
export const uiText = {
  es: {
    ...analyze.es,
    ...common.es,
    ...dashboard.es,
    ...estimate.es,
    ...explore.es,
    ...heatmap.es,
    ...listing.es,
    ...nearby.es,
    ...nextSteps.es,
    ...opportunities.es,
    ...priceDrops.es,
    ...share.es,
    ...subscribe.es,
    ...zones.es,
  },
  en: {
    ...analyze.en,
    ...common.en,
    ...dashboard.en,
    ...estimate.en,
    ...explore.en,
    ...heatmap.en,
    ...listing.en,
    ...nearby.en,
    ...nextSteps.en,
    ...opportunities.en,
    ...priceDrops.en,
    ...share.en,
    ...subscribe.en,
    ...zones.en,
  },
}
