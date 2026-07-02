import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { haversineWithinMetersSql } from "@/lib/geoHaversine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseCoord(v: string | null): number | null {
  if (v == null || !v.trim()) return null;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city")?.trim() ?? "";
    if (!city) {
      return NextResponse.json({ error: "city_required" }, { status: 400 });
    }
    const lat = parseCoord(searchParams.get("latitude"));
    const lng = parseCoord(searchParams.get("longitude"));
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "coordinates_required" },
        { status: 400 },
      );
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "coordinates_invalid" }, { status: 400 });
    }
    let radiusM = 2000;
    const rParam = searchParams.get("radiusMeters");
    if (rParam) {
      const r = Number.parseFloat(rParam);
      if (Number.isFinite(r) && r >= 300 && r <= 30000) radiusM = Math.round(r);
    }

    const rows = await prisma.$queryRaw<
      Array<{ name: string; cnt: bigint }>
    >(Prisma.sql`
      SELECT l.conjunto AS name, COUNT(*)::bigint AS cnt
      FROM listings l
      WHERE l.city = ${city}
        AND l.conjunto IS NOT NULL
        AND TRIM(l.conjunto) <> ''
        AND l.latitude IS NOT NULL
        AND l.longitude IS NOT NULL
        AND ${haversineWithinMetersSql(lat, lng, radiusM)}
      GROUP BY l.conjunto
      ORDER BY cnt DESC
      LIMIT 40
    `);

    return NextResponse.json({
      conjuntos: rows.map((r) => ({
        name: r.name,
        count: Number(r.cnt),
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
