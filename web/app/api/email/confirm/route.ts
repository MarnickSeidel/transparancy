import { NextResponse } from "next/server"

import { confirmContact } from "@/lib/email/subscribeContact"
import { absoluteUrl } from "@/lib/siteUrl"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")?.trim()
    if (!token) {
      return NextResponse.redirect(absoluteUrl("/email/confirmed?status=invalid"))
    }

    const contact = await confirmContact(token)
    if (!contact) {
      return NextResponse.redirect(absoluteUrl("/email/confirmed?status=invalid"))
    }

    const lang = contact.locale === "en" ? "en" : "es"
    return NextResponse.redirect(absoluteUrl(`/email/confirmed?status=ok&lang=${lang}`))
  } catch (e) {
    console.error("[email/confirm]", e)
    return NextResponse.redirect(absoluteUrl("/email/confirmed?status=invalid"))
  }
}
