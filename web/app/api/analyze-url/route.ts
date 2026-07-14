import { NextResponse } from "next/server";

import { buildListingDetailResponse } from "@/lib/getListingDetail";
import { prisma } from "@/lib/prisma";
import {
  fetchHtmlWithTimeout,
  parseSingleListingFromHtml,
  validateFincaraizUrl,
} from "@/lib/fincaraizSingleListing";
import { enforceRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

type Body = { url?: unknown };

function toPpm2(price: number, area: number | null): number | null {
  if (area == null || area <= 0) return null;
  return price / area;
}

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "analyze-url", 10, 15 * 60_000)
  if (limited) return limited

  try {
    const body = (await req.json()) as Body;
    const raw = typeof body.url === "string" ? body.url : "";
    if (!raw.trim()) {
      return NextResponse.json({ error: "url_required" }, { status: 400 });
    }

    let canonical: string;
    try {
      canonical = validateFincaraizUrl(raw);
    } catch (e) {
      const code = e instanceof Error ? e.message : "url_invalid";
      return NextResponse.json({ error: code }, { status: 400 });
    }

    const existing = await prisma.listing.findFirst({
      where: { url: canonical },
      orderBy: { lastSeenAt: "desc" },
    });
    if (existing) {
      return NextResponse.json(await buildListingDetailResponse(existing));
    }

    const html = await fetchHtmlWithTimeout(canonical, 15000);
    const parsed = parseSingleListingFromHtml(canonical, html);

    const pricePerM2 = toPpm2(parsed.priceCop, parsed.areaM2);
    const pricePerM2Built = toPpm2(parsed.priceCop, parsed.areaBuiltM2);
    const pricePerM2Terrain = toPpm2(parsed.priceCop, parsed.areaTerrainM2);

    const now = new Date();
    const upserted = await prisma.listing.upsert({
      where: { externalId: parsed.externalId },
      create: {
        externalId: parsed.externalId,
        title: parsed.title,
        url: parsed.url,
        priceCop: BigInt(parsed.priceCop),
        areaM2: parsed.areaM2,
        estrato: parsed.estrato ?? undefined,
        neighborhood: parsed.neighborhood ?? undefined,
        city: parsed.city,
        department: parsed.department,
        propertyType: parsed.propertyType ?? undefined,
        operationType: parsed.operationType ?? undefined,
        areaBuiltM2: parsed.areaBuiltM2 ?? undefined,
        areaTerrainM2: parsed.areaTerrainM2 ?? undefined,
        bedrooms: parsed.bedrooms ?? undefined,
        bathrooms: parsed.bathrooms ?? undefined,
        latitude: parsed.latitude ?? undefined,
        longitude: parsed.longitude ?? undefined,
        pricePerM2: pricePerM2 ?? undefined,
        pricePerM2Built: pricePerM2Built ?? undefined,
        pricePerM2Terrain: pricePerM2Terrain ?? undefined,
        imageUrl: parsed.imageUrl ?? undefined,
        address: parsed.address ?? undefined,
        technicalSheet: parsed.technicalSheet ?? undefined,
        locationPath: parsed.locationPath,
        sourceFingerprint: parsed.sourceFingerprint,
        sourceUpdatedAt: now,
        sourceCreatedAt: now,
        dateScraped: now,
        firstSeenAt: now,
        lastSeenAt: now,
        isActive: true,
      },
      update: {
        title: parsed.title,
        url: parsed.url,
        priceCop: BigInt(parsed.priceCop),
        areaM2: parsed.areaM2,
        estrato: parsed.estrato ?? null,
        neighborhood: parsed.neighborhood ?? null,
        city: parsed.city,
        department: parsed.department,
        propertyType: parsed.propertyType ?? null,
        operationType: parsed.operationType ?? null,
        areaBuiltM2: parsed.areaBuiltM2 ?? null,
        areaTerrainM2: parsed.areaTerrainM2 ?? null,
        bedrooms: parsed.bedrooms ?? null,
        bathrooms: parsed.bathrooms ?? null,
        latitude: parsed.latitude ?? null,
        longitude: parsed.longitude ?? null,
        pricePerM2: pricePerM2,
        pricePerM2Built: pricePerM2Built,
        pricePerM2Terrain: pricePerM2Terrain,
        imageUrl: parsed.imageUrl ?? null,
        address: parsed.address ?? null,
        technicalSheet: parsed.technicalSheet ?? undefined,
        locationPath: parsed.locationPath,
        sourceFingerprint: parsed.sourceFingerprint,
        sourceUpdatedAt: now,
        dateScraped: now,
        lastSeenAt: now,
        isActive: true,
        timesSeen: { increment: 1 },
      },
    });

    return NextResponse.json(await buildListingDetailResponse(upserted));
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "server_error";
    if (
      msg === "fetch_failed" ||
      msg === "next_data_missing" ||
      msg === "listing_payload_missing" ||
      msg === "price_missing" ||
      msg === "area_missing"
    ) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
