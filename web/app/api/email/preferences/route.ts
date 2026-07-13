import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { isEmailList, normalizeOptional } from "@/lib/email/validate"

export const dynamic = "force-dynamic"

function normalizeToken(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  if (!s) return null
  return s.length > 200 ? s.slice(0, 200) : s
}

function pickToken(req: Request): string | null {
  const url = new URL(req.url)
  return normalizeToken(url.searchParams.get("token"))
}

export async function GET(req: Request) {
  try {
    const token = pickToken(req)
    if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 })

    const contact = await prisma.emailContact.findUnique({
      where: { unsubscribeToken: token },
      include: { preferences: true },
    })
    if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 })

    return NextResponse.json({
      contact: {
        email: contact.email,
        locale: contact.locale,
        status: contact.status,
        createdAt: contact.createdAt,
        confirmedAt: contact.confirmedAt,
      },
      preferences: contact.preferences
        .slice()
        .sort((a, b) => a.list.localeCompare(b.list)),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

type UpdatePref = {
  list?: unknown
  city?: unknown
  neighborhood?: unknown
  active?: unknown
}

export async function POST(req: Request) {
  try {
    const token = pickToken(req)
    if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 })

    const contact = await prisma.emailContact.findUnique({
      where: { unsubscribeToken: token },
      include: { preferences: true },
    })
    if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 })

    const body = (await req.json()) as { updates?: unknown; locale?: unknown }
    const updatesRaw = body.updates
    if (!Array.isArray(updatesRaw)) {
      return NextResponse.json({ error: "updates_required" }, { status: 400 })
    }

    const updates = updatesRaw
      .filter((u): u is UpdatePref => Boolean(u) && typeof u === "object")
      .map((u) => {
        const list = u.list
        const city = normalizeOptional(u.city)
        const neighborhood = normalizeOptional(u.neighborhood)
        const active = u.active === true
        return { list, city, neighborhood, active }
      })
      .filter((u) => isEmailList(u.list))
      .map((u) => ({
        list: u.list as import("@prisma/client").EmailList,
        city: u.city ?? null,
        neighborhood: u.neighborhood ?? null,
        active: u.active,
      }))

    if (updates.length === 0) {
      return NextResponse.json({ error: "no_valid_updates" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        const pref = contact.preferences.find(
          (p) =>
            p.list === u.list &&
            (p.city ?? null) === (u.city ?? null) &&
            (p.neighborhood ?? null) === (u.neighborhood ?? null),
        )
        if (!pref) continue
        await tx.emailPreference.update({
          where: { id: pref.id },
          data: { active: u.active },
        })
      }

      const remaining = await tx.emailPreference.count({
        where: { contactId: contact.id, active: true },
      })

      await tx.emailContact.update({
        where: { id: contact.id },
        data: { status: remaining > 0 ? "active" : "unsubscribed" },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

