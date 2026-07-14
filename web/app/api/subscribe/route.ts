import { NextResponse } from "next/server"

import { subscribeContact } from "@/lib/email/subscribeContact"
import {
  normalizeEmail,
  normalizeLocale,
  normalizeOptional,
  parsePreferences,
} from "@/lib/email/validate"
import { enforceRateLimit } from "@/lib/rateLimit"

export const dynamic = "force-dynamic"

type Body = {
  email?: unknown
  locale?: unknown
  source?: unknown
  city?: unknown
  neighborhood?: unknown
  lists?: unknown
  preferences?: unknown
}

function legacyListsFromBody(body: Body) {
  const lists = body.lists
  const city = normalizeOptional(body.city)
  const neighborhood = normalizeOptional(body.neighborhood)
  if (Array.isArray(lists) && lists.length > 0) {
    return lists
      .filter((l): l is string => typeof l === "string")
      .map((list) => ({ list, city, neighborhood }))
  }
  if (city) {
    return [
      { list: "deals_city", city, neighborhood: null },
      { list: "market_monthly_city", city, neighborhood: null },
    ]
  }
  return null
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "subscribe", 5, 60 * 60_000)
  if (limited) return limited

  try {
    const body = (await req.json()) as Body
    const email = normalizeEmail(body.email)
    if (!email) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 })
    }

    const preferences =
      parsePreferences(body.preferences) ??
      parsePreferences(legacyListsFromBody(body)) ??
      null

    if (!preferences) {
      return NextResponse.json({ error: "invalid_preferences" }, { status: 400 })
    }

    const result = await subscribeContact({
      email,
      locale: normalizeLocale(body.locale),
      source: normalizeOptional(body.source, 40) ?? undefined,
      preferences,
    })

    if (!result.ok) {
      const status = result.error === "send_failed" ? 502 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      ok: true,
      needsConfirmation: result.needsConfirmation,
      devConfirmUrl: result.devConfirmUrl,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
