/** Green: below local ref avg; yellow: within band; red: above. Band is ±3% of ref. */

export type PriceSignal = "below" | "average" | "above";

export function priceSignal(
  pricePerM2: number | null,
  refAvg: number | null,
): PriceSignal {
  if (pricePerM2 == null || refAvg == null || refAvg <= 0) return "average";
  const low = refAvg * 0.97;
  const high = refAvg * 1.03;
  if (pricePerM2 < low) return "below";
  if (pricePerM2 > high) return "above";
  return "average";
}

export function refAverageForListing(
  neighborhood: string | null,
  neighborhoodAvgs: Map<string | null, number>,
  cityAvg: number | null,
): number | null {
  if (neighborhood && neighborhoodAvgs.has(neighborhood)) {
    const v = neighborhoodAvgs.get(neighborhood);
    if (v != null && v > 0) return v;
  }
  const nullAvg = neighborhoodAvgs.get(null);
  if (nullAvg != null && nullAvg > 0) return nullAvg;
  return cityAvg;
}

export function dealScore(
  pricePerM2: number | null,
  refAvg: number | null,
  sourceUpdatedAt: Date | null,
  completenessScore: number | null,
): number | null {
  if (pricePerM2 == null || refAvg == null || refAvg <= 0) return null;
  const relDiscount = Math.max(
    -1,
    Math.min(1, (refAvg - pricePerM2) / refAvg),
  );
  const now = Date.now();
  const updatedMs = sourceUpdatedAt ? sourceUpdatedAt.getTime() : now;
  const ageDays = Math.max(0, (now - updatedMs) / 86400000);
  const freshness = Math.max(0, 1 - Math.min(ageDays / 30, 1));
  const completeness = Math.max(0, Math.min(1, completenessScore ?? 0));
  return Number((relDiscount * 80 + freshness * 12 + completeness * 8).toFixed(4));
}
