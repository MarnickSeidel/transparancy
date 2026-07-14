import { NextResponse } from "next/server";
import type { Listing } from "@prisma/client";

import {
  analyzeDeal,
  buildWhyDeal,
  toDealListingInput,
} from "@/lib/dealEngine";
import { fetchAnalyzeCompPool } from "@/lib/fetchAnalyzeCompPool";
import { haversineMeters } from "@/lib/geoHaversine";
import { prisma } from "@/lib/prisma";
import {
  fetchHtmlWithTimeout,
  parseSingleListingFromHtml,
  validateFincaraizUrl,
} from "@/lib/fincaraizSingleListing";

export const dynamic = "force-dynamic";

type Body = { url?: unknown };
type Verdict = "good_deal" | "fair" | "overpriced";

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

function verdictFromAnalysis(analysis: {
  compSampleSize: number;
  refPpm2: number | null;
  discountVsRefPct: number | null;
  confidence: "high" | "medium" | "low";
}): Verdict {
  if (analysis.compSampleSize === 0 || analysis.refPpm2 == null) {
    return "fair";
  }
  return verdictFromDiscount(analysis.discountVsRefPct);
}

function confidenceForResponse(analysis: {
  compSampleSize: number;
  refPpm2: number | null;
  confidence: "high" | "medium" | "low";
}): "high" | "medium" | "low" {
  if (
    analysis.compSampleSize === 0 ||
    analysis.refPpm2 == null ||
    !Number.isFinite(analysis.refPpm2) ||
    analysis.refPpm2 <= 0
  ) {
    return "low";
  }
  return analysis.confidence;
}

async function buildAnalyzeResponse(upserted: Listing) {
  const poolRows = await fetchAnalyzeCompPool(upserted);

  const pool = poolRows.map((r) => toDealListingInput(r));
  const subject = toDealListingInput(upserted);
  const rowById = new Map(poolRows.map((r) => [r.id, r]));

  const priceEvents = await prisma.listingPriceEvent.findMany({
    where: {
      listingId: upserted.id,
      recordedAt: { gte: new Date(Date.now() - 90 * 86400000) },
    },
    orderBy: { recordedAt: "desc" },
  });

  const analysis = analyzeDeal(subject, pool, {
    priceEvents: priceEvents.map((e) => ({
      priceCop: e.priceCop,
      recordedAt: e.recordedAt,
    })),
  });

  const verdict = verdictFromAnalysis(analysis);
  const responseConfidence = confidenceForResponse(analysis);
  const whyDeal = buildWhyDeal(analysis, subject);

  const priceTimeline = [
    ...priceEvents.map((e) => ({
      recordedAt: e.recordedAt.toISOString(),
      priceCop: e.priceCop.toString(),
    })),
  ];
  const currentPriceStr = upserted.priceCop.toString();
  const hasCurrent =
    priceTimeline.length === 0 ||
    priceTimeline[priceTimeline.length - 1]?.priceCop !== currentPriceStr;
  if (hasCurrent) {
    priceTimeline.push({
      recordedAt: (upserted.sourceUpdatedAt ?? new Date()).toISOString(),
      priceCop: currentPriceStr,
    });
  }

  return {
    listing: {
      id: upserted.id,
      externalId: upserted.externalId,
      title: upserted.title,
      url: upserted.url,
      city: upserted.city,
      neighborhood: upserted.neighborhood,
      zoneName: upserted.zoneName,
      propertyType: upserted.propertyType,
      operationType: upserted.operationType,
      priceCop: upserted.priceCop.toString(),
      areaM2: upserted.areaM2,
      areaBuiltM2: upserted.areaBuiltM2,
      areaPrivateM2: upserted.areaPrivateM2,
      areaTerrainM2: upserted.areaTerrainM2,
      areaTerraceM2: upserted.areaTerraceM2,
      estrato: upserted.estrato,
      bedrooms: upserted.bedrooms,
      bathrooms: upserted.bathrooms,
      garage: upserted.garage,
      pricePerM2: analysis.subjectPpm2,
      acceptsBarter: upserted.acceptsBarter,
      facilities: upserted.facilities,
      constructionState: upserted.constructionState,
      latitude: upserted.latitude,
      longitude: upserted.longitude,
      address: upserted.address,
      technicalSheet: upserted.technicalSheet,
    },
    analysis: {
      dealScore: analysis.dealScore,
      verdict,
      confidence: responseConfidence,
      warnings: analysis.excluded
        ? analysis.exclusionReasons
        : analysis.confidenceReasons,
      discountVsRefPct: analysis.discountVsRefPct,
      referencePpm2: analysis.refPpm2,
      referencePpm2Nearby: analysis.refPpm2,
      referencePpm2Neighborhood: analysis.refPpm2,
      sampleSize: analysis.compSampleSize,
      compMethod: analysis.compMethod,
      metricType: analysis.metricType,
      scoreBreakdown: analysis.breakdown,
      priceDropPct: analysis.priceDropPct,
      domDays: analysis.domDays,
      whyDeal,
    },
    priceTimeline,
    comps: analysis.selectedComps.slice(0, 8).flatMap((comp) => {
      const c = rowById.get(comp.id);
      if (!c) return [];
      let distanceMeters: number | null = null;
      if (
        upserted.latitude != null &&
        upserted.longitude != null &&
        c.latitude != null &&
        c.longitude != null
      ) {
        distanceMeters = haversineMeters(
          upserted.latitude,
          upserted.longitude,
          c.latitude,
          c.longitude,
        );
      }
      return [
        {
          id: c.id,
          title: c.title,
          city: c.city,
          neighborhood: c.neighborhood,
          priceCop: c.priceCop.toString(),
          areaM2: c.areaM2,
          pricePerM2: c.pricePerM2,
          distanceMeters,
          url: c.url,
        },
      ];
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
