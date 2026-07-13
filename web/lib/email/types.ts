import type { EmailList } from "@prisma/client"

export type { EmailList }

export const EMAIL_LISTS: EmailList[] = [
  "deals_city",
  "deals_neighborhood",
  "price_drops_city",
  "market_monthly_city",
  "market_quarterly_colombia",
]

export type SubscribePreferenceInput = {
  list: EmailList
  city?: string | null
  neighborhood?: string | null
}

export type SubscribeInput = {
  email: string
  locale?: string
  source?: string
  preferences: SubscribePreferenceInput[]
}

export function listRequiresCity(list: EmailList): boolean {
  return list !== "market_quarterly_colombia"
}

export function listRequiresNeighborhood(list: EmailList): boolean {
  return list === "deals_neighborhood"
}
