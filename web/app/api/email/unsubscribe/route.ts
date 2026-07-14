import { NextResponse } from "next/server"

import { isEmailList } from "@/lib/email/validate"
import { unsubscribeContact } from "@/lib/email/subscribeContact"
import { absoluteUrl } from "@/lib/siteUrl"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")?.trim()
  const listRaw = searchParams.get("list")?.trim()
  const list = listRaw && isEmailList(listRaw) ? listRaw : null

  if (!token) {
    return NextResponse.redirect(absoluteUrl("/email/unsubscribed?status=invalid"))
  }

  if (!list) {
    return NextResponse.redirect(
      absoluteUrl(`/email/preferences?token=${encodeURIComponent(token)}`),
    )
  }

  const updated = await unsubscribeContact(token, list)
  if (!updated) {
    return NextResponse.redirect(absoluteUrl("/email/unsubscribed?status=invalid"))
  }

  const lang = updated.contact.locale === "en" ? "en" : "es"
  const scope = list ? `&list=${list}` : ""
  return NextResponse.redirect(absoluteUrl(`/email/unsubscribed?status=ok&lang=${lang}${scope}`))
}
