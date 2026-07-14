import { NextResponse } from "next/server"

import { getListingDetail } from "@/lib/getListingDetail"

export const dynamic = "force-dynamic"

type RouteContext = { params: { id: string } }

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const detail = await getListingDetail(params.id)
    if (!detail) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    return NextResponse.json(detail, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
