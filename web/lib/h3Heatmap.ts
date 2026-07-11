import { latLngToCell, cellToBoundary, cellToLatLng } from "h3-js";

import { percentile } from "@/lib/analytics";
import { pricePerM2Bucket, type PriceBucket } from "@/lib/mapPriceBuckets";

export const DEFAULT_H3_RESOLUTION = 8;
export const MIN_H3_RESOLUTION = 7;
export const MAX_H3_RESOLUTION = 9;

export type ListingGeoPoint = {
  latitude: number;
  longitude: number;
  pricePerM2: number;
  neighborhood: string | null;
};

export type H3HeatCell = {
  h3Index: string;
  count: number;
  medianPpm2: number;
  p25Ppm2: number;
  p75Ppm2: number;
  bucket: PriceBucket;
  center: { lat: number; lng: number };
  boundary: Array<[number, number]>;
  topNeighborhood: string | null;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function topNeighborhood(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [name, n] of counts) {
    if (n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

export function aggregateListingsToH3(
  listings: ListingGeoPoint[],
  resolution: number,
): {
  cells: H3HeatCell[];
  scale: { p25: number | null; p50: number | null; p75: number | null };
  listingCount: number;
} {
  const cellData = new Map<
    string,
    { prices: number[]; neighborhoods: Map<string, number> }
  >();

  for (const listing of listings) {
    const h3Index = latLngToCell(
      listing.latitude,
      listing.longitude,
      resolution,
    );
    let bucket = cellData.get(h3Index);
    if (!bucket) {
      bucket = { prices: [], neighborhoods: new Map() };
      cellData.set(h3Index, bucket);
    }
    bucket.prices.push(listing.pricePerM2);
    const nb = listing.neighborhood?.trim();
    if (nb) {
      bucket.neighborhoods.set(nb, (bucket.neighborhoods.get(nb) ?? 0) + 1);
    }
  }

  const allPrices = listings.map((l) => l.pricePerM2);
  const scaleP25 = percentile(allPrices, 0.25);
  const scaleP50 = percentile(allPrices, 0.5);
  const scaleP75 = percentile(allPrices, 0.75);

  const cells: H3HeatCell[] = [];
  for (const [h3Index, data] of cellData) {
    if (data.prices.length === 0) continue;
    const med = median(data.prices);
    const [lat, lng] = cellToLatLng(h3Index);
    const boundary = cellToBoundary(h3Index) as Array<[number, number]>;
    cells.push({
      h3Index,
      count: data.prices.length,
      medianPpm2: med,
      p25Ppm2: percentile(data.prices, 0.25) ?? med,
      p75Ppm2: percentile(data.prices, 0.75) ?? med,
      bucket: pricePerM2Bucket(med, scaleP25, scaleP50, scaleP75),
      center: { lat, lng },
      boundary,
      topNeighborhood: topNeighborhood(data.neighborhoods),
    });
  }

  cells.sort((a, b) => b.count - a.count);

  return {
    cells,
    scale: { p25: scaleP25, p50: scaleP50, p75: scaleP75 },
    listingCount: listings.length,
  };
}

export function parseH3Resolution(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return DEFAULT_H3_RESOLUTION;
  return Math.max(MIN_H3_RESOLUTION, Math.min(MAX_H3_RESOLUTION, n));
}
