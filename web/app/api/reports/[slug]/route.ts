import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { isSharedAnalyzePayload } from "@/lib/shareReport"

export const dynamic = "force-dynamic"

type Params = { params: { slug: string } }

export async function GET(_req: Request, { params }: Params) {
  try {
    const slug = params.slug?.trim()
    if (!slug) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const report = await prisma.sharedReport.findUnique({ where: { slug } })
    if (!report) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    if (report.expiresAt && report.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 410 })
    }

    if (!isSharedAnalyzePayload(report.payload)) {
      return NextResponse.json({ error: "invalid_report" }, { status: 500 })
    }

    return NextResponse.json({
      slug: report.slug,
      lang: report.lang,
      createdAt: report.createdAt.toISOString(),
      payload: report.payload,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
