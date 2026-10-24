import { NextResponse } from "next/server"

import { confirmContact } from "@/lib/email/subscribeContact"
import { localePath } from "@/lib/locale"
import { absoluteUrl } from "@/lib/siteUrl"

export const dynamic = "force-dynamic"

const confirmedUrl = (status: "ok" | "invalid") =>
  absoluteUrl(localePath("es", `/email/confirmed?status=${status}`))

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token")?.trim()
    if (!token) {
      return NextResponse.redirect(confirmedUrl("invalid"))
    }

    const contact = await confirmContact(token)
    if (!contact) {
      return NextResponse.redirect(confirmedUrl("invalid"))
    }

    return NextResponse.redirect(confirmedUrl("ok"))
  } catch (e) {
    console.error("[email/confirm]", e)
    return NextResponse.redirect(confirmedUrl("invalid"))
  }
}
