import { NextResponse } from "next/server";

import { getZoneDossier } from "@/lib/getZoneDossier";
import { parseMinCount } from "@/lib/zones";

export const dynamic = "force-dynamic";

type RouteContext = { params: { citySlug: string; zoneSlug: string } };

export async function GET(req: Request, { params }: RouteContext) {
  const { citySlug, zoneSlug } = params;
  const { searchParams } = new URL(req.url);
  const minDataPoints = parseMinCount(
    searchParams.get("minDataPoints"),
    searchParams.get("minCount"),
  );

  try {
    const dossier = await getZoneDossier(citySlug, zoneSlug, minDataPoints);
    if (!dossier) {
      return NextResponse.json({ error: "Zone not found." }, { status: 404 });
    }
    return NextResponse.json(dossier, {
      status: dossier.published ? 200 : 202,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Is Postgres running and migrated?" },
      { status: 503 },
    );
  }
}