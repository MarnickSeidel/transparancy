import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { MIN_ANALYTICS_AREA_M2, MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { haversineWithinMetersSql } from "@/lib/geoHaversine";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rateLimit";
import { enforceSameOrigin } from "@/lib/requestOrigin";
import { resolveConjuntoVariants } from "@/lib/resolveConjuntoVariants";

export const dynamic = "force-dynamic";

type Body = {
  city?: unknown;
  neighborhood?: unknown;
  propertyType?: unknown;
  areaM2?: unknown;
  estrato?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  radiusMeters?: unknown;
  conjunto?: unknown;
};

type ActiveFilters = {
  neighborhood: boolean;
  propertyType: boolean;
  estrato: boolean;
  conjunto: boolean;
};

type GeoFilter = { lat: number; lng: number; radiusM: number };

function buildConditions(
  city: string,
  user: {
    neighborhood?: string;
    neighborhoodKey?: string;
    propertyType?: string;
    estrato?: number;
    conjunto?: string;
    conjuntoVariants?: string[];
  },
  active: ActiveFilters,
  geo: GeoFilter | null,
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [
    Prisma.sql`l.price_per_m2 IS NOT NULL`,
    Prisma.sql`l.area_m2 >= ${MIN_ANALYTICS_AREA_M2}`,
    Prisma.sql`l.city = ${city}`,
  ];
  if (geo) {
    parts.push(Prisma.sql`l.latitude IS NOT NULL AND l.longitude IS NOT NULL`);
    parts.push(haversineWithinMetersSql(geo.lat, geo.lng, geo.radiusM));
  }
  if (active.neighborhood && user.neighborhoodKey) {
    parts.push(Prisma.sql`
      regexp_replace(
        regexp_replace(
          lower(translate(coalesce(l.neighborhood, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')),
          '\m(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\M',
          ' ',
          'g'
        ),
        '[^a-z0-9]+',
        '',
        'g'
      ) = ${user.neighborhoodKey}
    `);
  }
  if (active.propertyType && user.propertyType) {
    parts.push(Prisma.sql`l.property_type = ${user.propertyType}`);
  }
  if (active.estrato && user.estrato != null) {
    parts.push(Prisma.sql`l.estrato = ${user.estrato}`);
  }
  if (active.conjunto && user.conjuntoVariants && user.conjuntoVariants.length > 0) {
    parts.push(
      Prisma.sql`l.conjunto IN (${Prisma.join(
        user.conjuntoVariants.map((v) => Prisma.sql`${v}`),
      )})`,
    );
  } else if (active.conjunto && user.conjunto) {
    parts.push(Prisma.sql`l.conjunto = ${user.conjunto}`);
  }
  return parts;
}

async function compStats(conditions: Prisma.Sql[]) {
  const rows = await prisma.$queryRaw<
    Array<{
      cnt: bigint;
      p25: number | null;
      p50: number | null;
      p75: number | null;
    }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS cnt,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p25,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2)::float8 AS p75
    FROM listings l
    WHERE ${Prisma.join(conditions, " AND ")}
  `);
  return rows[0];
}

function broaden(active: ActiveFilters): ActiveFilters | null {
  if (active.neighborhood) return { ...active, neighborhood: false };
  if (active.propertyType) return { ...active, propertyType: false };
  if (active.estrato) return { ...active, estrato: false };
  if (active.conjunto) return { ...active, conjunto: false };
  return null;
}

function describeFallback(
  initial: ActiveFilters,
  final: ActiveFilters,
): string[] {
  const dropped: string[] = [];
  if (initial.neighborhood && !final.neighborhood) dropped.push("neighborhood");
  if (initial.propertyType && !final.propertyType) dropped.push("propertyType");
  if (initial.estrato && !final.estrato) dropped.push("estrato");
  if (initial.conjunto && !final.conjunto) dropped.push("conjunto");
  return dropped;
}

function wideningRadii(startM: number): number[] {
  const ladder = [
    500, 1000, 2000, 3000, 5000, 8000, 12000, 20000,
  ];
  return Array.from(new Set([startM, ...ladder])).sort((a, b) => a - b);
}

async function findComps(
  city: string,
  user: {
    neighborhood?: string;
    neighborhoodKey?: string;
    propertyType?: string;
    estrato?: number;
    conjunto?: string;
    conjuntoVariants?: string[];
  },
  initial: ActiveFilters,
  geo: { lat: number; lng: number; startRadiusM: number } | null,
): Promise<{
  stats: Awaited<ReturnType<typeof compStats>>;
  active: ActiveFilters;
  geoUsed: GeoFilter | null;
  geoDropped: boolean;
}> {
  if (!geo) {
    let active = { ...initial };
    let stats = await compStats(buildConditions(city, user, active, null));
    while (stats.cnt === BigInt(0)) {
      const next = broaden(active);
      if (!next) break;
      active = next;
      stats = await compStats(buildConditions(city, user, active, null));
    }
    return { stats, active, geoUsed: null, geoDropped: false };
  }

  const radii = wideningRadii(geo.startRadiusM);
  for (const radiusM of radii) {
    let active = { ...initial };
    const g: GeoFilter = { lat: geo.lat, lng: geo.lng, radiusM };
    let stats = await compStats(buildConditions(city, user, active, g));
    while (stats.cnt === BigInt(0)) {
      const next = broaden(active);
      if (!next) break;
      active = next;
      stats = await compStats(buildConditions(city, user, active, g));
    }
    if (stats.cnt > BigInt(0)) {
      return { stats, active, geoUsed: g, geoDropped: false };
    }
  }

  let active = { ...initial };
  let stats = await compStats(buildConditions(city, user, active, null));
  while (stats.cnt === BigInt(0)) {
    const next = broaden(active);
    if (!next) break;
    active = next;
    stats = await compStats(buildConditions(city, user, active, null));
  }
  return { stats, active, geoUsed: null, geoDropped: true };
}

function parseCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function POST(req: Request) {
  const originBlocked = enforceSameOrigin(req);
  if (originBlocked) return originBlocked;

  const limited = enforceRateLimit(req, "estimate", 20, 15 * 60_000);
  if (limited) return limited;

  try {
    const body = (await req.json()) as Body;
    const city =
      typeof body.city === "string" ? body.city.trim() : "";
    if (!city) {
      return NextResponse.json({ error: "city_required" }, { status: 400 });
    }

    const areaM2 =
      typeof body.areaM2 === "number"
        ? body.areaM2
        : typeof body.areaM2 === "string"
          ? Number.parseFloat(body.areaM2)
          : Number.NaN;
    if (!Number.isFinite(areaM2) || areaM2 <= 0) {
      return NextResponse.json({ error: "area_invalid" }, { status: 400 });
    }

    const neighborhood =
      typeof body.neighborhood === "string" && body.neighborhood.trim()
        ? body.neighborhood.trim()
        : undefined;
    const neighborhoodKey = neighborhood
      ? normalizeNeighborhoodKey(neighborhood)
      : undefined;
    const propertyType =
      typeof body.propertyType === "string" && body.propertyType.trim()
        ? body.propertyType.trim()
        : undefined;
    const conjunto =
      typeof body.conjunto === "string" && body.conjunto.trim()
        ? body.conjunto.trim()
        : undefined;
    const conjuntoVariants = conjunto
      ? await resolveConjuntoVariants(city, conjunto)
      : undefined;
    let estrato: number | undefined;
    if (body.estrato != null && body.estrato !== "") {
      const e =
        typeof body.estrato === "number"
          ? body.estrato
          : Number.parseInt(String(body.estrato), 10);
      if (!Number.isNaN(e)) estrato = e;
    }

    const lat = parseCoord(body.latitude);
    const lng = parseCoord(body.longitude);
    let radiusStart = 500;
    if (body.radiusMeters != null && body.radiusMeters !== "") {
      const r =
        typeof body.radiusMeters === "number"
          ? body.radiusMeters
          : Number.parseFloat(String(body.radiusMeters));
      if (Number.isFinite(r) && r >= 500 && r <= 50000) radiusStart = Math.round(r);
    }

    let geoInput: { lat: number; lng: number; startRadiusM: number } | null =
      null;
    if (lat != null && lng != null) {
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json({ error: "coordinates_invalid" }, { status: 400 });
      }
      geoInput = { lat, lng, startRadiusM: radiusStart };
    } else if (lat != null || lng != null) {
      return NextResponse.json({ error: "coordinates_incomplete" }, { status: 400 });
    }

    const user = {
      neighborhood,
      neighborhoodKey,
      propertyType,
      estrato,
      conjunto,
      conjuntoVariants,
    };

    const initial: ActiveFilters = {
      neighborhood: !!neighborhoodKey,
      propertyType: !!propertyType,
      estrato: estrato != null,
      conjunto: !!conjunto,
    };

    const { stats, active, geoUsed, geoDropped } = await findComps(
      city,
      user,
      initial,
      geoInput,
    );

    if (stats.cnt === BigInt(0)) {
      return NextResponse.json(
        { error: "insufficient_data", message: "no_comps" },
        { status: 422 },
      );
    }

    const sample = Number(stats.cnt);
    const p25 = stats.p25;
    const p50 = stats.p50;
    const p75 = stats.p75;

    if (p25 == null || p50 == null || p75 == null) {
      return NextResponse.json(
        { error: "insufficient_data", message: "no_percentiles" },
        { status: 422 },
      );
    }

    const low = Math.round(p25 * areaM2);
    const mid = Math.round(p50 * areaM2);
    const high = Math.round(p75 * areaM2);

    const minSampleMet = sample >= MIN_SAMPLE_SIZE;
    const droppedFilters = describeFallback(initial, active);

    return NextResponse.json({
      sampleSize: sample,
      minSampleSize: MIN_SAMPLE_SIZE,
      minSampleMet,
      ppm2: {
        p25,
        median: p50,
        p75,
      },
      totalCop: {
        low,
        mid,
        high,
      },
      areaM2,
      city,
      filtersUsed: {
        neighborhood: active.neighborhood && !!neighborhood,
        propertyType: active.propertyType && !!propertyType,
        estrato: active.estrato && estrato != null,
        conjunto: active.conjunto && !!conjunto,
      },
      fallbackDropped: droppedFilters,
      geo:
        geoUsed != null
          ? {
              latitude: geoUsed.lat,
              longitude: geoUsed.lng,
              radiusMeters: geoUsed.radiusM,
            }
          : null,
      geoDropped,
      appliedConjunto:
        active.conjunto && conjunto ? conjunto : null,
      conjuntoVariantsMatched:
        active.conjunto && conjuntoVariants ? conjuntoVariants.length : 0,
      disclaimerKey: "listing_market_asking_only",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 },
    );
  }
}
