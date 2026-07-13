import type { EmailList } from "@prisma/client"

import {
  listRequiresCity,
  listRequiresNeighborhood,
  type SubscribePreferenceInput,
} from "@/lib/email/types"

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null
  const email = v.trim().toLowerCase()
  if (!email) return null
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return ok ? email : null
}

export function normalizeOptional(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

export function normalizeLocale(v: unknown): "es" | "en" {
  return v === "en" ? "en" : "es"
}

export function isEmailList(v: unknown): v is EmailList {
  return (
    v === "deals_city" ||
    v === "deals_neighborhood" ||
    v === "price_drops_city" ||
    v === "market_monthly_city" ||
    v === "market_quarterly_colombia"
  )
}

export function parsePreferences(raw: unknown): SubscribePreferenceInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: SubscribePreferenceInput[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const list = (item as { list?: unknown }).list
    if (!isEmailList(list)) continue
    const city = normalizeOptional((item as { city?: unknown }).city)
    const neighborhood = normalizeOptional((item as { neighborhood?: unknown }).neighborhood)

    if (listRequiresCity(list) && !city) continue
    if (listRequiresNeighborhood(list) && !neighborhood) continue

    const key = `${list}|${city ?? ""}|${neighborhood ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      list,
      city: listRequiresCity(list) ? city : null,
      neighborhood: listRequiresNeighborhood(list) ? neighborhood : null,
    })
  }

  return out.length > 0 ? out : null
}
