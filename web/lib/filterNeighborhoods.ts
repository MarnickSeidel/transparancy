/** Drop scraper noise from neighborhood filter dropdowns. */
export function isUsableNeighborhoodLabel(label: string): boolean {
  const t = label.trim()
  if (t.length < 2 || t.length > 48) return false
  if (/https?:\/\//i.test(t) || /maps\.google/i.test(t)) return false
  if (/^\[/.test(t) || t === "[PLACEHOLDER]") return false
  if (/^:\s/.test(t)) return false
  if (/^\d+\s+\d+\s/.test(t)) return false
  if (/^km\s+\d/i.test(t)) return false
  if (/^#\s*\d/.test(t)) return false
  const letterCount = (t.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) ?? []).length
  if (letterCount < 3) return false
  return true
}

export function pickBestNeighborhoodLabel(candidates: string[]): string | null {
  const usable = candidates.filter(isUsableNeighborhoodLabel)
  if (usable.length === 0) return null
  return usable.sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
}
