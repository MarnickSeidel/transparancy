import { NextResponse } from "next/server";
import type { Listing } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { dealScore, refAverageForListing } from "@/lib/transparency";
import {
  fetchHtmlWithTimeout,
  parseSingleListingFromHtml,
  validateFincaraizUrl,
} from "@/lib/fincaraizSingleListing";

export const dynamic = "force-dynamic";

type Body = { url?: unknown };
type Verdict = "good_deal" | "fair" | "overpriced";
type Confidence = "high" | "medium" | "low";

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toPpm2(price: number, area: number | null): number | null {
  if (area == null || area <= 0) return null;
  return price / area;
}

function verdictFromDiscount(discountPct: number | null): Verdict {
  if (discountPct == null) return "fair";
  if (discountPct >= 12) return "good_deal";
  if (discountPct <= -12) return "overpriced";
  return "fair";
}

function confidenceFromSignals(sampleSize: number, warnings: string[]): Confidence {
  let score = 100;
  if (sampleSize < 12) score -= 20;
  if (sampleSize < 6) score -= 20;
  score -= warnings.length * 10;
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function areaBand(area: number, tolerancePct: number): { min: number; max: number } {
  const delta = area * tolerancePct;
  return { min: Math.max(5, area - delta), max: area + delta };
}

async function getComps(opts: {
  city: string;
  propertyType: string | null;
  neighborhood: string | null;
  areaM2: number;
  sourceId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  // Preferred strategy requested: nearby (1km), same property type, sale listings.
  if (
    opts.latitude != null &&
    opts.longitude != null &&
    opts.propertyType != null &&
    opts.propertyType.trim() !== ""
  ) {
    const geoCandidates = await prisma.listing.findMany({
      where: {
        city: opts.city,
        id: { not: opts.sourceId },
        propertyType: opts.propertyType,
        operationType: { contains: "venta", mode: "insensitive" },
        latitude: { not: null },
        longitude: { not: null },
        pricePerM2: { not: null },
      },
      orderBy: { dateScraped: "desc" },
      take: 500,
    });

    const withDistance = geoCandidates
      .map((c) => {
        if (c.latitude == null || c.longitude == null) return null;
        const d = haversineMeters(opts.latitude!, opts.longitude!, c.latitude, c.longitude);
        return { c, d };
      })
      .filter((x): x is { c: (typeof geoCandidates)[number]; d: number } => x != null)
      .sort((a, b) => a.d - b.d);

    const near = withDistance
      .filter((x) => x.d <= 1000)
      .slice(0, 12)
      .map((x) => x.c);
    if (near.length > 0) return near;
  }

  // Fallback to previous area+neighborhood strategy when geo matching is sparse/unavailable.
  const tolerances = [0.2, 0.35, 0.5];
  for (const tol of tolerances) {
    const band = areaBand(opts.areaM2, tol);
    const whereBase = {
      city: opts.city,
      id: { not: opts.sourceId },
      areaM2: { gte: band.min, lte: band.max },
      pricePerM2: { not: null },
    };

    const strict = await prisma.listing.findMany({
      where: {
        ...whereBase,
        ...(opts.propertyType ? { propertyType: opts.propertyType } : {}),
        operationType: { contains: "venta", mode: "insensitive" },
        ...(opts.neighborhood ? { neighborhood: opts.neighborhood } : {}),
      },
      orderBy: { dateScraped: "desc" },
      take: 12,
    });
    if (strict.length >= 6) return strict;

    const relaxed = await prisma.listing.findMany({
      where: {
        ...whereBase,
        ...(opts.propertyType ? { propertyType: opts.propertyType } : {}),
        operationType: { contains: "venta", mode: "insensitive" },
      },
      orderBy: { dateScraped: "desc" },
      take: 12,
    });
    if (relaxed.length > 0) return relaxed;
  }
  return [];
}

async function buildAnalyzeResponse(upserted: Listing) {
  const comps = await getComps({
    city: upserted.city,
    propertyType: upserted.propertyType,
    neighborhood: upserted.neighborhood,
    areaM2: upserted.areaM2,
    sourceId: upserted.id,
    latitude: upserted.latitude,
    longitude: upserted.longitude,
  });

  const nbAvgs = new Map<string | null, number>();
  for (const c of comps) {
    if (c.pricePerM2 == null) continue;
    const arr = nbAvgs.get(c.neighborhood) ?? 0;
    nbAvgs.set(c.neighborhood, arr + c.pricePerM2);
  }
  const nbCounts = new Map<string | null, number>();
  for (const c of comps) {
    if (c.pricePerM2 == null) continue;
    nbCounts.set(c.neighborhood, (nbCounts.get(c.neighborhood) ?? 0) + 1);
  }
    for (const [k, sum] of Array.from(nbAvgs.entries())) {
    const n = nbCounts.get(k) ?? 1;
    nbAvgs.set(k, sum / n);
  }
  const cityAvg =
    comps
      .map((c) => c.pricePerM2)
      .filter((v): v is number => v != null)
      .reduce((a, b) => a + b, 0) / Math.max(1, comps.filter((c) => c.pricePerM2 != null).length);

  const subjectPpm2 =
    upserted.pricePerM2 ??
    (upserted.areaM2 > 0 ? Number(upserted.priceCop) / upserted.areaM2 : null);
  const refNearby = refAverageForListing(upserted.neighborhood, nbAvgs, cityAvg || null);

  let refNeighborhood: number | null = null;
  if (upserted.neighborhood && upserted.neighborhood.trim()) {
    const neighborhoodRows = await prisma.listing.findMany({
      where: {
        city: upserted.city,
        neighborhood: upserted.neighborhood,
        id: { not: upserted.id },
        operationType: { contains: "venta", mode: "insensitive" },
        pricePerM2: { not: null },
      },
      select: { pricePerM2: true },
      take: 500,
    });
    const values = neighborhoodRows
      .map((r) => r.pricePerM2)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length > 0) {
      refNeighborhood = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  const score = dealScore(
    subjectPpm2,
    refNearby,
    upserted.sourceUpdatedAt,
    upserted.dataCompletenessScore,
  );
  const discountPct =
    subjectPpm2 != null && refNearby != null && refNearby > 0
      ? ((refNearby - subjectPpm2) / refNearby) * 100
      : null;
  const warnings: string[] = [];
  if (upserted.neighborhood == null || !upserted.neighborhood.trim()) warnings.push("missing_neighborhood");
  if (upserted.areaBuiltM2 == null && upserted.areaTerrainM2 != null) warnings.push("built_vs_terrain_mismatch");
  if ((upserted.sourceUpdatedAt?.getTime() ?? 0) < Date.now() - 45 * 86400000) warnings.push("stale_listing");
  const confidence = confidenceFromSignals(comps.length, warnings);
  const verdict = verdictFromDiscount(discountPct);

  return {
    listing: {
      id: upserted.id,
      externalId: upserted.externalId,
      title: upserted.title,
      url: upserted.url,
      city: upserted.city,
      neighborhood: upserted.neighborhood,
      propertyType: upserted.propertyType,
      operationType: upserted.operationType,
      priceCop: upserted.priceCop.toString(),
      areaM2: upserted.areaM2,
      areaBuiltM2: upserted.areaBuiltM2,
      areaTerrainM2: upserted.areaTerrainM2,
      estrato: upserted.estrato,
      bedrooms: upserted.bedrooms,
      bathrooms: upserted.bathrooms,
      pricePerM2: subjectPpm2,
    },
    analysis: {
      dealScore: score,
      verdict,
      confidence,
      warnings,
      discountVsRefPct: discountPct,
      referencePpm2: refNearby,
      referencePpm2Nearby: refNearby,
      referencePpm2Neighborhood: refNeighborhood,
      sampleSize: comps.length,
    },
    comps: comps.map((c) => {
      const distanceMeters =
        upserted.latitude != null &&
        upserted.longitude != null &&
        c.latitude != null &&
        c.longitude != null
          ? Math.round(
              haversineMeters(
                upserted.latitude,
                upserted.longitude,
                c.latitude,
                c.longitude,
              ),
            )
          : null;
      return {
        id: c.id,
        title: c.title,
        city: c.city,
        neighborhood: c.neighborhood,
        priceCop: c.priceCop.toString(),
        areaM2: c.areaM2,
        pricePerM2: c.pricePerM2,
        distanceMeters,
        url: c.url,
      };
    }),
  };
}

export async function POST(req: Request) {
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
      return NextResponse.json(await buildAnalyzeResponse(existing));
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
        locationPath: parsed.locationPath,
        sourceFingerprint: parsed.sourceFingerprint,
        sourceUpdatedAt: now,
        sourceCreatedAt: now,
        dateScraped: now,
        firstSeenAt: now,
        lastSeenAt: now,
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
        locationPath: parsed.locationPath,
        sourceFingerprint: parsed.sourceFingerprint,
        sourceUpdatedAt: now,
        dateScraped: now,
        lastSeenAt: now,
        timesSeen: { increment: 1 },
      },
    });

    return NextResponse.json(await buildAnalyzeResponse(upserted));
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
