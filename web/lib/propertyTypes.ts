import type { Lang } from "@/lib/i18n"

const TYPE_LABELS: Record<string, { es: string; en: string }> = {
  Apartaestudio: { es: "Apartaestudio", en: "Studio apt" },
  Apartamento: { es: "Apartamento", en: "Apartment" },
  Bodega: { es: "Bodega", en: "Warehouse" },
  Casa: { es: "Casa", en: "House" },
  Finca: { es: "Finca", en: "Farm / estate" },
  Local: { es: "Local", en: "Commercial unit" },
  Lote: { es: "Lote", en: "Lot" },
  Oficina: { es: "Oficina", en: "Office" },
}

export function propertyTypeLabel(type: string | null | undefined, lang: Lang): string {
  if (!type?.trim()) return "—"
  const entry = TYPE_LABELS[type.trim()]
  if (!entry) return type
  return entry[lang]
}

export function propertyTypeOptions(
  types: string[],
  lang: Lang,
): Array<{ value: string; label: string }> {
  return types.map((t) => ({ value: t, label: propertyTypeLabel(t, lang) }))
}
