/** Quantile + color buckets for map markers (COP/m²). */

export type PriceBucket = 0 | 1 | 2 | 3;

export const BUCKET_COLORS: Record<PriceBucket, { fill: string; stroke: string }> = {
  0: { fill: "#22c55e", stroke: "#15803d" },
  1: { fill: "#eab308", stroke: "#a16207" },
  2: { fill: "#f97316", stroke: "#c2410c" },
  3: { fill: "#ef4444", stroke: "#b91c1c" },
};

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const idx = (arr.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return arr[low];
  const w = idx - low;
  return arr[low] * (1 - w) + arr[high] * w;
}

export function pricePerM2Bucket(
  ppm2: number,
  p25: number | null,
  p50: number | null,
  p75: number | null,
): PriceBucket {
  if (p25 == null || p50 == null || p75 == null) return 1;
  if (ppm2 <= p25) return 0;
  if (ppm2 <= p50) return 1;
  if (ppm2 <= p75) return 2;
  return 3;
}
