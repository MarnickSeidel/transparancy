import type { EmailList, EmailPreference } from "@prisma/client"

import { getRecentPriceDrops } from "@/lib/getPriceDrops"
import { getTopOpportunities } from "@/lib/getTopOpportunities"
import { getGlobalDataFreshness } from "@/lib/getDataFreshness"
import { queryMonthlyTrends } from "@/lib/monthlyTrends"
import { priorityCities } from "@/lib/i18n"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email/sendEmail"
import {
  buildColombiaDigestEmail,
  buildDealDigestEmail,
  buildMarketDigestEmail,
  buildPriceDropDigestEmail,
  unsubscribeUrl,
} from "@/lib/email/templates"

export type DigestRunResult = {
  sent: number
  skipped: number
  errors: number
  details: string[]
}

type DigestKeyContext = {
  /** Keyed to underlying data freshness to avoid duplicate sends. */
  dataKey: string
}

function fmtCopBig(v: bigint | number | string, locale: string) {
  const n = typeof v === "bigint" ? Number(v) : typeof v === "string" ? Number(v) : v
  if (Number.isNaN(n)) return String(v)
  return `$ ${Math.round(n).toLocaleString(locale)}`
}

async function alreadySent(contactId: string, digestKey: string) {
  const row = await prisma.emailSendLog.findUnique({
    where: { contactId_digestKey: { contactId, digestKey } },
  })
  return Boolean(row)
}

async function logSend(contactId: string, preferenceId: string, digestKey: string) {
  await prisma.emailSendLog.create({
    data: { contactId, preferenceId, digestKey },
  })
  await prisma.emailPreference.update({
    where: { id: preferenceId },
    data: { lastSentAt: new Date() },
  })
}

async function sendForPreference(
  pref: EmailPreference & {
    contact: { id: string; email: string; locale: string; unsubscribeToken: string }
  },
  ctx: DigestKeyContext,
): Promise<"sent" | "skipped" | "error"> {
  const digestKey = `${ctx.dataKey}:${pref.list}:${pref.city ?? "all"}:${pref.neighborhood ?? "all"}`
  if (await alreadySent(pref.contact.id, digestKey)) return "skipped"

  const locale = "es" as const
  const localeTag = "es-CO"
  const unsub = unsubscribeUrl(pref.contact.unsubscribeToken, pref.list)
  const dataDate = new Date().toLocaleDateString(localeTag)

  if (pref.list === "deals_city" || pref.list === "deals_neighborhood") {
    if (!pref.city) return "skipped"
    const opps = await getTopOpportunities({
      city: pref.city,
      neighborhood: pref.list === "deals_neighborhood" ? pref.neighborhood ?? undefined : undefined,
      pageSize: 5,
    })
    if (opps.items.length === 0) return "skipped"
    const mail = buildDealDigestEmail({
      locale,
      city: pref.city,
      neighborhood: pref.list === "deals_neighborhood" ? pref.neighborhood : null,
      listings: opps.items.map((o) => ({
        title: o.title,
        url: o.url,
        priceCop: fmtCopBig(o.priceCop, localeTag),
        pricePerM2: o.pricePerM2,
        discountPct: o.discountVsRefPct,
        neighborhood: o.neighborhood,
      })),
      unsubscribeUrl: unsub,
      dataDate,
    })
    const sent = await sendEmail({ to: pref.contact.email, ...mail })
    if (!sent.ok) return "error"
    await logSend(pref.contact.id, pref.id, digestKey)
    return "sent"
  }

  if (pref.list === "price_drops_city") {
    if (!pref.city) return "skipped"
    const drops = await getRecentPriceDrops({ city: pref.city, limit: 8, days: 30 })
    if (drops.length === 0) return "skipped"
    const mail = buildPriceDropDigestEmail({
      locale,
      city: pref.city,
      drops: drops.map((d) => ({
        title: d.title,
        url: d.url,
        priceCop: fmtCopBig(d.priceCop, localeTag),
        previousPriceCop: fmtCopBig(d.previousPriceCop, localeTag),
        dropPct: d.dropPct,
        neighborhood: d.neighborhood,
      })),
      unsubscribeUrl: unsub,
      dataDate,
    })
    const sent = await sendEmail({ to: pref.contact.email, ...mail })
    if (!sent.ok) return "error"
    await logSend(pref.contact.id, pref.id, digestKey)
    return "sent"
  }

  if (pref.list === "market_monthly_city") {
    if (!pref.city) return "skipped"
    const trends = await queryMonthlyTrends({ city: pref.city, months: 3 })
    const rows = trends.rows.filter((r) => r.medianPpm2 != null)
    const latest = rows.at(-1)
    const prev = rows.length >= 2 ? rows.at(-2) : null
    const momChangePct =
      latest?.medianPpm2 != null && prev?.medianPpm2 != null && prev.medianPpm2 > 0
        ? ((latest.medianPpm2 - prev.medianPpm2) / prev.medianPpm2) * 100
        : null

    const [activeListings, dealCount, priceDropCount] = await Promise.all([
      prisma.listing.count({ where: { city: pref.city, isActive: true } }),
      prisma.listing.count({ where: { city: pref.city, isActive: true, isDeal: true } }),
      getRecentPriceDrops({ city: pref.city, limit: 100, days: 30 }).then((d) => d.length),
    ])

    const monthLabel = latest?.month ?? dataDate
    const mail = buildMarketDigestEmail({
      locale,
      city: pref.city,
      monthLabel,
      medianPpm2: latest?.medianPpm2 ?? null,
      momChangePct,
      sample: latest?.sample ?? 0,
      activeListings,
      dealCount,
      priceDropCount,
      unsubscribeUrl: unsub,
    })
    const sent = await sendEmail({ to: pref.contact.email, ...mail })
    if (!sent.ok) return "error"
    await logSend(pref.contact.id, pref.id, digestKey)
    return "sent"
  }

  if (pref.list === "market_quarterly_colombia") {
    const cityStats = await Promise.all(
      priorityCities.map(async (city) => {
        const trends = await queryMonthlyTrends({ city, months: 2 })
        const rows = trends.rows.filter((r) => r.medianPpm2 != null)
        const latest = rows.at(-1)
        const prev = rows.length >= 2 ? rows.at(-2) : null
        const momChangePct =
          latest?.medianPpm2 != null && prev?.medianPpm2 != null && prev.medianPpm2 > 0
            ? ((latest.medianPpm2 - prev.medianPpm2) / prev.medianPpm2) * 100
            : null
        return {
          city,
          medianPpm2: latest?.medianPpm2 ?? null,
          momChangePct,
          sample: latest?.sample ?? 0,
        }
      }),
    )
    const now = new Date()
    const q = Math.floor(now.getUTCMonth() / 3) + 1
    const quarterLabel = `Q${q} ${now.getUTCFullYear()}`
    const mail = buildColombiaDigestEmail({
      locale,
      quarterLabel,
      cities: cityStats.filter((c) => c.sample > 0),
      unsubscribeUrl: unsub,
    })
    const sent = await sendEmail({ to: pref.contact.email, ...mail })
    if (!sent.ok) return "error"
    await logSend(pref.contact.id, pref.id, digestKey)
    return "sent"
  }

  return "skipped"
}

export async function runEmailDigests(args?: {
  city?: string | null
  list?: EmailList | null
  force?: boolean
}): Promise<DigestRunResult> {
  const result: DigestRunResult = { sent: 0, skipped: 0, errors: 0, details: [] }

  const freshness = await getGlobalDataFreshness()
  const dataKey = freshness.lastScrapedAt
    ? `scrape:${freshness.lastScrapedAt.toISOString().slice(0, 10)}`
    : `scrape:none`
  const ctx: DigestKeyContext = { dataKey }

  const prefs = await prisma.emailPreference.findMany({
    where: {
      active: true,
      contact: { status: "active" },
      ...(args?.list ? { list: args.list } : {}),
      ...(args?.city ? { city: args.city } : {}),
    },
    include: {
      contact: {
        select: { id: true, email: true, locale: true, unsubscribeToken: true },
      },
    },
  })

  for (const pref of prefs) {
    if (args?.force) {
      const digestKey = `${ctx.dataKey}:${pref.list}:${pref.city ?? "all"}:${pref.neighborhood ?? "all"}`
      await prisma.emailSendLog.deleteMany({
        where: { contactId: pref.contact.id, digestKey },
      })
    }
    try {
      const status = await sendForPreference(pref, ctx)
      if (status === "sent") result.sent += 1
      else if (status === "skipped") result.skipped += 1
      else result.errors += 1
      result.details.push(`${pref.contact.email} · ${pref.list} · ${status}`)
    } catch (e) {
      result.errors += 1
      result.details.push(`${pref.contact.email} · ${pref.list} · error`)
      console.error("[email digest]", e)
    }
  }

  return result
}
