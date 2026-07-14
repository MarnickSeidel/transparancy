import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  createReportSlug,
  isSharedAnalyzePayload,
  type SharedAnalyzePayload,
} from "@/lib/shareReport"
import { enforceRateLimit } from "@/lib/rateLimit"

export const dynamic = "force-dynamic"

const REPORT_TTL_DAYS = 90

type Body = {
  payload?: unknown
  lang?: unknown
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "reports-share", 20, 60 * 60_000)
  if (limited) return limited

  try {
    const body = (await req.json()) as Body
    if (!isSharedAnalyzePayload(body.payload)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
    }

    const lang = body.lang === "en" ? "en" : "es"
    const payload = body.payload as SharedAnalyzePayload
    const slug = createReportSlug()
    const expiresAt = new Date(Date.now() + REPORT_TTL_DAYS * 86400000)

    await prisma.sharedReport.create({
      data: {
        slug,
        payload: payload as Prisma.InputJsonValue,
        lang,
        expiresAt,
      },
    })

    return NextResponse.json({ slug, path: `/r/${slug}` })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
