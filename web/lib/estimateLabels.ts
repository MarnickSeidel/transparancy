import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

type FallbackKey = "neighborhood" | "propertyType" | "estrato" | "conjunto"

export function estimateFallbackLabel(key: string, lang: Lang): string {
  const txt = uiText[lang]
  const map: Record<FallbackKey, string> = {
    neighborhood: txt.estimateFallbackNeighborhood,
    propertyType: txt.estimateFallbackPropertyType,
    estrato: txt.estimateFallbackEstrato,
    conjunto: txt.estimateFallbackConjunto,
  }
  if (key in map) return map[key as FallbackKey]
  return key.replace(/_/g, " ")
}
