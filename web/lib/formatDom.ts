import type { Lang } from "@/lib/i18n"

export const domDaysFromFirstSeen = (
  firstSeenAt: Date | string | null | undefined,
): number | null => {
  if (!firstSeenAt) return null
  const start = firstSeenAt instanceof Date ? firstSeenAt : new Date(firstSeenAt)
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000))
}

export const formatDomDays = (
  days: number | null | undefined,
  lang: Lang,
): string | null => {
  if (days == null || !Number.isFinite(days)) return null
  const rounded = Math.round(days)
  if (lang === "es") {
    if (rounded <= 0) return "Nuevo hoy"
    if (rounded === 1) return "1 día en mercado"
    return `${rounded} días en mercado`
  }
  if (rounded <= 0) return "Listed today"
  if (rounded === 1) return "1 day on market"
  return `${rounded} days on market`
}

export const domBadgeTone = (
  days: number | null | undefined,
): "new" | "normal" | "aging" | "stale" => {
  if (days == null || !Number.isFinite(days)) return "normal"
  if (days <= 7) return "new"
  if (days <= 45) return "normal"
  if (days <= 90) return "aging"
  return "stale"
}
