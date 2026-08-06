import { NextResponse } from "next/server"

import { fetchAndParseAnalyzeListing, validateAnalyzeListingUrl } from "@/lib/analyzeListingUrl"
import { buildListingDetailResponse } from "@/lib/getListingDetail"
import {
  persistAnalyzedDealScore,
  upsertAnalyzedListing,
} from "@/lib/upsertAnalyzedListing"
import { enforceRateLimit } from "@/lib/rateLimit"
import { enforceSameOrigin } from "@/lib/requestOrigin"

export const dynamic = "force-dynamic"

type Body = { url?: unknown }

export async function POST(req: Request) {
  const originBlocked = enforceSameOrigin(req)
  if (originBlocked) return originBlocked

  const limited = enforceRateLimit(req, "analyze-url", 10, 15 * 60_000)
  if (limited) return limited

  try {
    const body = (await req.json()) as Body
    const raw = typeof body.url === "string" ? body.url : ""
    if (!raw.trim()) {
      return NextResponse.json({ error: "url_required" }, { status: 400 })
    }

    try {
      validateAnalyzeListingUrl(raw)
    } catch (e) {
      const code = e instanceof Error ? e.message : "url_invalid"
      return NextResponse.json({ error: code }, { status: 400 })
    }

    // Always re-fetch the portal listing so analyze-url keeps the DB fresh.
    const parsed = await fetchAndParseAnalyzeListing(raw)
    const { listing, created, priceChanged } = await upsertAnalyzedListing(parsed)
    const detail = await buildListingDetailResponse(listing)

    await persistAnalyzedDealScore(listing.id, detail.analysis)

    return NextResponse.json({
      ...detail,
      meta: {
        created,
        priceChanged,
        refreshed: true,
      },
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : "server_error"
    if (
      msg === "fetch_failed" ||
      msg === "next_data_missing" ||
      msg === "listing_payload_missing" ||
      msg === "price_missing" ||
      msg === "area_missing" ||
      msg === "url_not_allowed" ||
      msg === "url_path_invalid"
    ) {
      const status =
        msg === "url_not_allowed" || msg === "url_path_invalid" ? 400 : 422
      return NextResponse.json({ error: msg }, { status })
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
