/** Extract a display label from a facilities JSON entry (string or { name }). */
const facilityLabel = (item: unknown): string | null => {
  if (typeof item === "string" && item.trim()) return item.trim()
  if (typeof item === "number" && Number.isFinite(item)) return String(item)
  if (!item || typeof item !== "object") return null

  const row = item as Record<string, unknown>
  for (const key of ["name", "label", "title", "value"] as const) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

/** Ordered facility labels for narrative / enrichment. */
export const listFacilities = (raw: unknown, max = 4): string[] => {
  if (!raw) return []

  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map(facilityLabel)
      .filter((label): label is string => Boolean(label))
      .slice(0, max)
  }

  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(
        ([, value]) => value === true || (typeof value === "string" && value.trim()),
      )
      .map(([key, value]) => (value === true ? key : `${key}: ${value}`))
      .slice(0, max)
  }

  return []
}

/** Human-readable facilities list for listing detail / analyze-url enrichment. */
export const formatFacilities = (raw: unknown): string | null => {
  const labels = listFacilities(raw, 50)
  return labels.length > 0 ? labels.join(", ") : null
}
