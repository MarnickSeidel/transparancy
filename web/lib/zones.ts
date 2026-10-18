import { Prisma } from "@prisma/client";

import { catalogKeyForCity } from "@/lib/neighborhoodResolver";
import { normalizeNeighborhoodKey } from "@/lib/neighborhoods";

export type ZoneSlugResolution = {
  citySlug: string;
  zoneSlug: string;
  bucketKey: string;
  href: string;
};

export const DEFAULT_MIN_ZONE_DATA_POINTS = 20;
/** @deprecated Use DEFAULT_MIN_ZONE_DATA_POINTS — kept for call sites using minCount. */
export const DEFAULT_MIN_ZONE_COUNT = DEFAULT_MIN_ZONE_DATA_POINTS;
export const DEFAULT_ZONE_CITY = "Pereira";

export type ZoneConfidence = "catalog" | "source_id" | "provisional" | "weak" | "missing";

export type ConfidenceMix = Record<ZoneConfidence, number>;

export type PublishableZone = {
  slug: string;
  displayName: string;
  city: string;
  citySlug: string;
  bucketKey: string;
  listingCount: number;
  dataPointCount: number;
  medianPricePerM2: number | null;
  confidenceMix: ConfidenceMix;
  dominantConfidence: ZoneConfidence;
};

export type ZoneAlias = {
  label: string;
  count: number;
};

export type ZonePropertyTypeStat = {
  type: string;
  count: number;
  medianPricePerM2: number | null;
};

export type ZoneGroupMedian = {
  dataPointCount: number;
  medianPricePerM2: number | null;
  medianPriceCop: number | null;
};

export type ZoneMonthlyTrend = {
  month: string;
  sample: number;
  medianPpm2: number | null;
};

export type ZoneDossier = PublishableZone & {
  published: boolean;
  minDataPoints: number;
  medianPriceCop: number | null;
  opportunityCount: number;
  propertyTypes: ZonePropertyTypeStat[];
  groupMedians: { apt: ZoneGroupMedian; house: ZoneGroupMedian };
  aliases: ZoneAlias[];
  exploreNeighborhood: string;
  monthlyTrend: ZoneMonthlyTrend[];
  lastUpdatedAt: string | null;
  centroidLatitude: number | null;
  centroidLongitude: number | null;
  geoListingCount: number;
};

export function effectivePpm2(
  pricePerM2: number | null | undefined,
  pricePerM2Private: number | null | undefined,
  priceCop?: number | null | undefined,
  areaM2?: number | null | undefined,
): number | null {
  if (pricePerM2 != null && Number.isFinite(pricePerM2) && pricePerM2 > 0) {
    return pricePerM2;
  }
  if (
    pricePerM2Private != null &&
    Number.isFinite(pricePerM2Private) &&
    pricePerM2Private > 0
  ) {
    return pricePerM2Private;
  }
  if (
    priceCop != null &&
    Number.isFinite(priceCop) &&
    priceCop > 0 &&
    areaM2 != null &&
    Number.isFinite(areaM2) &&
    areaM2 > 0
  ) {
    return priceCop / areaM2;
  }
  return null;
}

export function isDataPoint(args: {
  pricePerM2?: number | null;
  pricePerM2Private?: number | null;
  priceCop?: number | null;
  areaM2?: number | null;
}): boolean {
  return (
    effectivePpm2(
      args.pricePerM2,
      args.pricePerM2Private,
      args.priceCop,
      args.areaM2,
    ) != null
  );
}

export function bucketKeyFromListing(args: {
  qualityFlags: unknown;
  city: string;
  citySlug?: string | null;
  neighborhood?: string | null;
}): string | null {
  const flags = args.qualityFlags as Record<string, unknown> | null | undefined;
  const fromFlags =
    typeof flags?.dossier_key === "string" ? flags.dossier_key.trim() : "";
  if (fromFlags) return fromFlags;

  const neighborhood = args.neighborhood?.trim();
  if (!neighborhood) return null;

  const cityKey =
    catalogKeyForCity(args.city, args.citySlug) ??
    args.city.trim().toLowerCase().replace(/\s+/g, "-");
  const nk = normalizeNeighborhoodKey(neighborhood);
  if (!nk) return null;
  return `${cityKey}:${nk}`;
}

export function citySlugFromBucketKey(bucketKey: string): string {
  const idx = bucketKey.indexOf(":");
  return idx === -1 ? bucketKey : bucketKey.slice(0, idx);
}

export function zoneSlugFromBucketKey(bucketKey: string): string {
  const idx = bucketKey.indexOf(":");
  if (idx === -1) return bucketKey;
  const rest = bucketKey.slice(idx + 1);
  if (rest.startsWith("uuid:")) {
    return `uuid-${rest.slice(5)}`;
  }
  return rest;
}

/** Resolve dossier URL slugs from a canonical city + neighborhood label. */
export function slugFromCityNeighborhood(
  city: string,
  neighborhood: string,
): ZoneSlugResolution | null {
  const trimmed = neighborhood.trim();
  if (!trimmed) return null;

  const cityKey =
    catalogKeyForCity(city) ?? city.trim().toLowerCase().replace(/\s+/g, "-");
  let nk = normalizeNeighborhoodKey(trimmed);
  if (!nk) return null;
  if (trimmed.toLowerCase().endsWith(" rural") && !nk.endsWith("-rural")) {
    nk = `${nk}-rural`;
  }

  const citySlug = cityKey;
  const zoneSlug = nk;
  const bucketKey = `${cityKey}:${nk}`;
  return {
    citySlug,
    zoneSlug,
    bucketKey,
    href: `/zones/${encodeURIComponent(citySlug)}/${encodeURIComponent(zoneSlug)}`,
  };
}

export function bucketKeyFromSlug(citySlug: string, zoneSlug: string): string {
  if (zoneSlug.startsWith("uuid-")) {
    return `${citySlug}:uuid:${zoneSlug.slice(5)}`;
  }
  return `${citySlug}:${zoneSlug}`;
}

export function parseMinDataPoints(raw: string | null | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_MIN_ZONE_DATA_POINTS;
  return parsed;
}

/** Accepts minDataPoints or legacy minCount query param. */
export function parseMinCount(
  minDataPointsRaw: string | null | undefined,
  minCountRaw?: string | null | undefined,
): number {
  return parseMinDataPoints(minDataPointsRaw ?? minCountRaw);
}

/** SQL expression matching bucketKeyFromListing fallback for active-listing aggregations. */
export function sqlBucketKey(): Prisma.Sql {
  return Prisma.sql`
    COALESCE(
      NULLIF(btrim(l.quality_flags->>'dossier_key'), ''),
      CASE
        WHEN l.neighborhood IS NOT NULL AND btrim(l.neighborhood) <> '' THEN
          lower(
            regexp_replace(
              regexp_replace(btrim(COALESCE(l.city_slug, l.city)), '^city-colombia-', ''),
              '[_\\s]+',
              '-',
              'g'
            )
          )
          || ':'
          || regexp_replace(
            regexp_replace(
              lower(
                translate(
                  btrim(l.neighborhood),
                  'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòù',
                  'AEIOUUNaeiouunAEIOUaeiou'
                )
              ),
              '\\y(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\\y',
              ' ',
              'gi'
            ),
            '[^a-z0-9]+',
            '',
            'g'
          )
      END
    )
  `;
}

export function sqlEffectivePpm2(): Prisma.Sql {
  return Prisma.sql`
    COALESCE(
      NULLIF(l.price_per_m2, 0),
      NULLIF(l.price_per_m2_private, 0),
      CASE
        WHEN l.price_cop IS NOT NULL AND l.price_cop > 0
          AND l.area_m2 IS NOT NULL AND l.area_m2 > 0
        THEN l.price_cop::float8 / l.area_m2
      END
    )
  `;
}

type RawZoneRow = {
  bucket_key: string;
  city: string;
  display_name: string | null;
  listing_count: bigint;
  data_point_count: bigint;
  median_ppm2: number | null;
  catalog_count: bigint;
  source_id_count: bigint;
  provisional_count: bigint;
  weak_count: bigint;
  missing_count: bigint;
};

export function mapRawZoneRow(row: RawZoneRow, citySlug?: string): PublishableZone {
  const bucketKey = row.bucket_key;
  const resolvedCitySlug = citySlugFromBucketKey(bucketKey) || citySlug || row.city.toLowerCase().replace(/\s+/g, "-");
  const confidenceMix = {
    catalog: Number(row.catalog_count),
    source_id: Number(row.source_id_count),
    provisional: Number(row.provisional_count),
    weak: Number(row.weak_count),
    missing: Number(row.missing_count),
  };
  return {
    slug: zoneSlugFromBucketKey(bucketKey),
    displayName: row.display_name?.trim() || bucketKey.split(":").slice(1).join(":"),
    city: row.city,
    citySlug: resolvedCitySlug,
    bucketKey,
    listingCount: Number(row.listing_count),
    dataPointCount: Number(row.data_point_count),
    medianPricePerM2: row.median_ppm2,
    confidenceMix,
    dominantConfidence: dominantConfidence(confidenceMix),
  };
}

/** Highest-count neighborhood confidence tier in a zone aggregate. */
export function dominantConfidence(mix: ConfidenceMix): ZoneConfidence {
  const entries = Object.entries(mix) as [ZoneConfidence, number][];
  if (entries.every(([, n]) => n === 0)) return "missing";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Zone medians this many times above/below the city's median-of-medians are hidden from directories. */
export const ZONE_DIRECTORY_OUTLIER_RATIO = 3;

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Directory view of a city's zones: drops the bucket named after the city itself,
 * extreme median outliers, and the smaller of a readable/`uuid-` pair sharing a name.
 * Dossier pages stay reachable; this only affects lists.
 */
export function curateDirectoryZones(zones: PublishableZone[], city: string): PublishableZone[] {
  const cityKey = normalizeNeighborhoodKey(city);
  const named = zones.filter((z) => normalizeNeighborhoodKey(z.displayName) !== cityKey);

  const baseline = medianOf(
    named.map((z) => z.medianPricePerM2).filter((v): v is number => v != null && v > 0),
  );
  const inRange = baseline
    ? named.filter(
        (z) =>
          z.medianPricePerM2 == null ||
          (z.medianPricePerM2 <= baseline * ZONE_DIRECTORY_OUTLIER_RATIO &&
            z.medianPricePerM2 >= baseline / ZONE_DIRECTORY_OUTLIER_RATIO),
      )
    : named;

  const byName = new Map<string, PublishableZone>();
  const bySize = [...inRange].sort((a, b) => b.dataPointCount - a.dataPointCount);
  for (const zone of bySize) {
    const key = normalizeNeighborhoodKey(zone.displayName) || zone.bucketKey;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, zone);
      continue;
    }
    if (existing.slug.startsWith("uuid-") === zone.slug.startsWith("uuid-")) {
      byName.set(`${key}#${zone.bucketKey}`, zone);
    }
  }
  return Array.from(byName.values()).sort((a, b) => b.dataPointCount - a.dataPointCount);
}

export function isApartmentType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t.includes("apartamento") || t.includes("apto");
}

export function isHouseType(type: string): boolean {
  return type.trim().toLowerCase().includes("casa");
}
