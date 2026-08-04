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

/** Human-readable facilities list for listing detail / analyze-url enrichment. */
export const formatFacilities = (raw: unknown): string | null => {
  if (!raw) return null

  if (Array.isArray(raw) && raw.length > 0) {
    const labels = raw
      .map(facilityLabel)
      .filter((label): label is string => Boolean(label))
    return labels.length > 0 ? labels.join(", ") : null
  }

  if (typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>).filter(
      ([, value]) => value === true || (typeof value === "string" && value.trim()),
    )
    if (entries.length === 0) return null
    return entries
      .map(([key, value]) => (value === true ? key : `${key}: ${value}`))
      .join(", ")
  }

  return null
}
