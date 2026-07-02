export const MIN_ANALYTICS_AREA_M2 = 5;
export const MIN_SAMPLE_SIZE = 8;

export function median(values: number[]) {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 1 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const idx = (arr.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return arr[low];
  const w = idx - low;
  return arr[low] * (1 - w) + arr[high] * w;
}

export function winsorizeByPercentile(values: number[], pct = 0.02) {
  if (values.length < 2) return values;
  const low = percentile(values, pct);
  const high = percentile(values, 1 - pct);
  if (low == null || high == null) return values;
  return values.map((v) => Math.min(high, Math.max(low, v)));
}

export function hasMinSample(n: number) {
  return n >= MIN_SAMPLE_SIZE;
}
