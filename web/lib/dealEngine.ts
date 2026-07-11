import {
  hasMinSample,
  median,
  MIN_SAMPLE_SIZE,
  winsorizeByPercentile,
} from "@/lib/analytics";
import { haversineMeters } from "@/lib/geoHaversine";
import { dealScore } from "@/lib/transparency";

export type MetricType = "private" | "built" | "terrain" | "generic";
export type ConfidenceLevel = "high" | "medium" | "low";

export type DealListingInput = {
  id: string;
  externalId?: string;
  city: string;
  neighborhood: string | null;
  zoneName: string | null;
  propertyType: string | null;
  constructionState: string | null;
  estrato: number | null;
  operationType: string | null;
  areaM2: number;
  areaBuiltM2: number | null;
  areaPrivateM2: number | null;
  areaTerrainM2: number | null;
  areaTerraceM2: number | null;
  priceCop: bigint | number;
  pricePerM2: number | null;
  pricePerM2Built: number | null;
  pricePerM2Private: number | null;
  pricePerM2Terrain: number | null;
  priceAdminIncluded: bigint | number | null;
  adminFeeCop: bigint | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  sourceUpdatedAt: Date | null;
  firstSeenAt: Date | null;
  dataCompletenessScore: number | null;
  acceptsBarter: boolean;
  terraceHeavyFlag: boolean;
  areaMismatchFlag: boolean;
  isProject: boolean;
  paidQuota: boolean | null;
  highlight: number | null;
  description: string | null;
};

export type PriceEventInput = {
  priceCop: bigint | number;
  recordedAt: Date;
};

export type DealScoreBreakdown = {
  discountComponent: number;
  freshnessComponent: number;
  completenessComponent: number;
  priceDropBonus: number;
  domBonus: number;
  barterPenalty: number;
  projectPenalty: number;
  promotedPenalty: number;
  lowSamplePenalty: number;
  highAdminPenalty: number;
  terrainRiskPenalty: number;
  typeLocationPenalty: number;
  priceSanityPenalty: number;
};

export type DealAnalysis = {
  excluded: boolean;
  exclusionReasons: string[];
  metricType: MetricType;
  subjectPpm2: number | null;
  refPpm2: number | null;
  compSampleSize: number;
  compMethod: string;
  discountVsRefPct: number | null;
  dealScore: number | null;
  breakdown: DealScoreBreakdown | null;
  confidence: ConfidenceLevel;
  confidenceReasons: string[];
  priceDropPct: number | null;
  domDays: number | null;
};

const GEO_RADIUS_M = 1000;
const MIN_RELAXED_SAMPLE = 4;

const MIN_STICKER_PRICE_COP: Record<string, number> = {
  casa: 80_000_000,
  apartamento: 40_000_000,
  lote: 30_000_000,
  finca: 50_000_000,
  local: 50_000_000,
};

const TERRAIN_RISK_KEYWORDS = [
  "empinado",
  "pendiente",
  "inundable",
  "inundacion",
  "inundación",
  "servidumbre",
  "deslizamiento",
  "escarpado",
  "riesgo de inund",
];

const TERRAIN_RISK_EXCLUDE_KEYWORDS = ["inundable", "inundacion", "inundación"];

function propertyTypeKey(propertyType: string | null): string {
  return (propertyType ?? "").trim().toLowerCase() || "unknown";
}

function isApartment(propertyType: string | null): boolean {
  const t = propertyTypeKey(propertyType);
  return t.includes("apartamento") || t.includes("apto");
}

function isHouse(propertyType: string | null): boolean {
  return propertyTypeKey(propertyType).includes("casa");
}

function isTerrainLike(propertyType: string | null): boolean {
  const t = propertyTypeKey(propertyType);
  return (
    t.includes("lote") ||
    t.includes("terreno") ||
    t.includes("finca") ||
    t.includes("parcela")
  );
}

function isCommercial(propertyType: string | null): boolean {
  const t = propertyTypeKey(propertyType);
  return t.includes("oficina") || t.includes("local");
}

function minStickerPriceCop(propertyType: string | null): number | null {
  const t = propertyTypeKey(propertyType);
  if (isHouse(propertyType)) return MIN_STICKER_PRICE_COP.casa;
  if (isApartment(propertyType)) return MIN_STICKER_PRICE_COP.apartamento;
  if (t.includes("lote") || t.includes("terreno")) return MIN_STICKER_PRICE_COP.lote;
  if (t.includes("finca") || t.includes("parcela")) return MIN_STICKER_PRICE_COP.finca;
  if (isCommercial(propertyType)) return MIN_STICKER_PRICE_COP.local;
  return null;
}

function minPpm2Floor(
  metricType: MetricType,
  propertyType: string | null,
): number | null {
  if (metricType === "terrain" || isTerrainLike(propertyType)) return 50_000;
  if (metricType === "private" || metricType === "built") return 400_000;
  if (metricType === "generic") {
    return isTerrainLike(propertyType) ? 50_000 : 400_000;
  }
  return null;
}

function terrainFamilyKey(propertyType: string | null): string {
  const t = propertyTypeKey(propertyType);
  if (t.includes("finca")) return "finca";
  if (t.includes("parcela")) return "parcela";
  if (t.includes("lote")) return "lote";
  if (t.includes("terreno")) return "terreno";
  return t;
}

function terrainTypesCompatible(
  subjectType: string | null,
  candidateType: string | null,
): boolean {
  if (!subjectType || !candidateType) return true;
  const a = terrainFamilyKey(subjectType);
  const b = terrainFamilyKey(candidateType);
  if (a === b) return true;
  const fincaGroup = new Set(["finca", "parcela"]);
  const loteGroup = new Set(["lote", "terreno"]);
  if (fincaGroup.has(a) && fincaGroup.has(b)) return true;
  if (loteGroup.has(a) && loteGroup.has(b)) return true;
  return false;
}

function isBelowPriceFloor(
  listing: DealListingInput,
  subjectPpm2: number | null,
  metricType: MetricType,
): boolean {
  const price = Number(listing.priceCop);
  const minSticker = minStickerPriceCop(listing.propertyType);
  const minPpm2 = minPpm2Floor(metricType, listing.propertyType);
  if (minSticker != null && price < minSticker) return true;
  if (minPpm2 != null && subjectPpm2 != null && subjectPpm2 < minPpm2) return true;
  return false;
}

export function priceSanityExclude(
  listing: DealListingInput,
  metricType: MetricType,
  subjectPpm2: number | null,
  discountVsRefPct: number | null,
): string[] {
  const reasons: string[] = [];
  const price = Number(listing.priceCop);
  const minSticker = minStickerPriceCop(listing.propertyType);
  const minPpm2 = minPpm2Floor(metricType, listing.propertyType);
  const belowSticker =
    minSticker != null && price > 0 && price < minSticker;
  const belowPpm2 =
    minPpm2 != null &&
    subjectPpm2 != null &&
    subjectPpm2 > 0 &&
    subjectPpm2 < minPpm2;

  if (minSticker != null && price > 0 && price < minSticker * 0.01) {
    reasons.push("likely_missing_zeros");
    return reasons;
  }

  if (discountVsRefPct != null && discountVsRefPct > 70 && (belowSticker || belowPpm2)) {
    reasons.push(belowSticker ? "likely_missing_zeros" : "price_outlier");
    return reasons;
  }

  if (belowSticker && minSticker != null && price < minSticker * 0.05) {
    reasons.push("likely_missing_zeros");
  } else if (belowSticker || belowPpm2) {
    reasons.push("price_outlier");
  }

  return reasons;
}

function stickerPriceMedianExclude(
  subject: DealListingInput,
  comps: DealListingInput[],
): string[] {
  if (comps.length < MIN_RELAXED_SAMPLE) return [];
  const compPrices = comps
    .map((c) => Number(c.priceCop))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (compPrices.length < MIN_RELAXED_SAMPLE) return [];
  const med = median(compPrices);
  const subjectPrice = Number(subject.priceCop);
  if (med != null && med > 0 && subjectPrice > 0 && subjectPrice < med * 0.01) {
    return ["likely_missing_zeros"];
  }
  return [];
}

function descriptionTerrainFlags(description: string | null): {
  hasRisk: boolean;
  shouldExclude: boolean;
} {
  if (!description?.trim()) return { hasRisk: false, shouldExclude: false };
  const d = description.toLowerCase();
  const hasRisk = TERRAIN_RISK_KEYWORDS.some((kw) => d.includes(kw));
  const shouldExclude = TERRAIN_RISK_EXCLUDE_KEYWORDS.some((kw) => d.includes(kw));
  return { hasRisk, shouldExclude };
}

function typeLocationMismatchReasons(listing: DealListingInput): string[] {
  if (!isTerrainLike(listing.propertyType)) return [];
  const reasons: string[] = [];
  const terrainArea = listing.areaTerrainM2 ?? listing.areaM2;
  const estrato = listing.estrato;

  if (estrato != null && estrato >= 4) {
    reasons.push("type_location_mismatch");
  } else if (
    terrainArea > 0 &&
    terrainArea < 500 &&
    estrato != null &&
    estrato >= 3
  ) {
    reasons.push("type_location_mismatch");
  }

  return reasons;
}

function compPropertyTypeMismatchRatio(
  subject: DealListingInput,
  comps: DealListingInput[],
): number {
  if (comps.length === 0) return 0;
  const subjectKey = propertyTypeKey(subject.propertyType);
  const mismatched = comps.filter(
    (c) => propertyTypeKey(c.propertyType) !== subjectKey,
  ).length;
  return mismatched / comps.length;
}

function isVenta(operationType: string | null): boolean {
  if (!operationType) return true;
  return operationType.toLowerCase().includes("venta");
}

function estratoMatches(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return true;
  return Math.abs(a - b) <= 1;
}

function constructionMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function areaBand(area: number, tolerancePct: number): { min: number; max: number } {
  const delta = area * tolerancePct;
  return { min: Math.max(5, area - delta), max: area + delta };
}

export function pickSubjectMetric(
  listing: DealListingInput,
): { metricType: MetricType; ppm2: number | null; scoringArea: number | null } {
  if (
    isApartment(listing.propertyType) &&
    listing.pricePerM2Private != null &&
    listing.areaPrivateM2 != null &&
    listing.areaPrivateM2 >= 20
  ) {
    return {
      metricType: "private",
      ppm2: listing.pricePerM2Private,
      scoringArea: listing.areaPrivateM2,
    };
  }

  if (
    isTerrainLike(listing.propertyType) &&
    listing.pricePerM2Terrain != null &&
    listing.areaTerrainM2 != null &&
    listing.areaTerrainM2 >= 50
  ) {
    return {
      metricType: "terrain",
      ppm2: listing.pricePerM2Terrain,
      scoringArea: listing.areaTerrainM2,
    };
  }

  if (
    listing.pricePerM2Built != null &&
    listing.areaBuiltM2 != null &&
    listing.areaBuiltM2 >= 20
  ) {
    return {
      metricType: "built",
      ppm2: listing.pricePerM2Built,
      scoringArea: listing.areaBuiltM2,
    };
  }

  if (
    listing.pricePerM2Terrain != null &&
    listing.areaTerrainM2 != null &&
    listing.areaTerrainM2 >= 80
  ) {
    return {
      metricType: "terrain",
      ppm2: listing.pricePerM2Terrain,
      scoringArea: listing.areaTerrainM2,
    };
  }

  return {
    metricType: "generic",
    ppm2: listing.pricePerM2,
    scoringArea: listing.areaM2,
  };
}

function compPpm2(listing: DealListingInput, metricType: MetricType): number | null {
  if (metricType === "private") return listing.pricePerM2Private;
  if (metricType === "built") return listing.pricePerM2Built ?? listing.pricePerM2;
  if (metricType === "terrain") return listing.pricePerM2Terrain;
  return listing.pricePerM2;
}

function compScoringArea(
  listing: DealListingInput,
  metricType: MetricType,
): number | null {
  if (metricType === "private") return listing.areaPrivateM2;
  if (metricType === "built") return listing.areaBuiltM2 ?? listing.areaM2;
  if (metricType === "terrain") return listing.areaTerrainM2;
  return listing.areaM2;
}

export function areaSanityExclude(
  listing: DealListingInput,
  minBuiltPpm2ForHouse = 900_000,
): string[] {
  const reasons: string[] = [];
  const t = propertyTypeKey(listing.propertyType);
  const area = listing.areaM2;

  if (isApartment(listing.propertyType)) {
    if (area > 500) reasons.push("apartment_area_too_large");
    if (area < 12) reasons.push("apartment_area_too_small");
    const privateM2 = listing.areaPrivateM2 ?? listing.areaBuiltM2;
    if (privateM2 != null && area > privateM2 * 1.15) {
      reasons.push("apartment_inflated_total_area");
    }
    if (
      privateM2 == null &&
      (listing.terraceHeavyFlag || listing.areaMismatchFlag) &&
      area >= 120
    ) {
      reasons.push("apartment_terrace_legacy_mismatch");
    }
    if (
      listing.areaTerraceM2 != null &&
      privateM2 != null &&
      listing.areaTerraceM2 >= privateM2 * 0.9
    ) {
      reasons.push("apartment_terrace_dominant");
    }
  } else if (isHouse(listing.propertyType)) {
    if (area >= 600 && (listing.areaBuiltM2 == null || listing.areaBuiltM2 < 220)) {
      reasons.push("house_terrain_built_mixup");
    }
    if (
      area < 25 &&
      (listing.areaBuiltM2 == null || listing.areaBuiltM2 < 25) &&
      (listing.areaTerrainM2 == null || listing.areaTerrainM2 < 100)
    ) {
      reasons.push("house_area_too_small");
    }
    if (
      listing.areaBuiltM2 != null &&
      listing.areaTerrainM2 != null &&
      listing.areaBuiltM2 > listing.areaTerrainM2 * 1.5
    ) {
      reasons.push("house_contradictory_areas");
    }
    if (
      area >= 900 &&
      (listing.bedrooms ?? 0) <= 6 &&
      (listing.bathrooms ?? 0) <= 8 &&
      listing.pricePerM2Built != null &&
      listing.pricePerM2Built < minBuiltPpm2ForHouse &&
      (listing.pricePerM2Terrain == null ||
        listing.pricePerM2Terrain <= listing.pricePerM2Built * 1.4)
    ) {
      reasons.push("house_low_built_density");
    }
  } else if (isTerrainLike(listing.propertyType)) {
    if (area < 50) reasons.push("terrain_area_too_small");
    if (area > 500_000) reasons.push("terrain_area_implausible");
  } else if (t.includes("oficina") || t.includes("local")) {
    if (area > 10_000) reasons.push("commercial_area_implausible");
  } else if (area > 20_000) {
    reasons.push("area_implausible");
  }

  if (listing.isProject) reasons.push("project_not_resale");
  return reasons;
}

function compCompatible(
  subject: DealListingInput,
  candidate: DealListingInput,
  metricType: MetricType,
): boolean {
  if (candidate.id === subject.id) return false;
  if (subject.city !== candidate.city) return false;
  if (!isVenta(candidate.operationType)) return false;

  if (
    subject.propertyType &&
    candidate.propertyType
  ) {
    if (isTerrainLike(subject.propertyType)) {
      if (!terrainTypesCompatible(subject.propertyType, candidate.propertyType)) {
        return false;
      }
    } else if (
      propertyTypeKey(subject.propertyType) !== propertyTypeKey(candidate.propertyType)
    ) {
      return false;
    }
  }

  if (!estratoMatches(subject.estrato, candidate.estrato)) return false;
  if (
    !constructionMatches(subject.constructionState, candidate.constructionState)
  ) {
    return false;
  }

  const ppm2 = compPpm2(candidate, metricType);
  if (ppm2 == null || !Number.isFinite(ppm2) || ppm2 <= 0) return false;

  const subjectArea = compScoringArea(subject, metricType);
  const candidateArea = compScoringArea(candidate, metricType);
  if (subjectArea != null && candidateArea != null && subjectArea > 0) {
    const band = areaBand(subjectArea, 0.35);
    if (candidateArea < band.min || candidateArea > band.max) return false;
  }

  return areaSanityExclude(candidate).length === 0;
}

function geoSortedComps(
  subject: DealListingInput,
  candidates: DealListingInput[],
): DealListingInput[] {
  if (subject.latitude == null || subject.longitude == null) return candidates;
  return [...candidates]
    .map((c) => {
      if (c.latitude == null || c.longitude == null) return { c, d: Number.POSITIVE_INFINITY };
      return {
        c,
        d: haversineMeters(
          subject.latitude!,
          subject.longitude!,
          c.latitude,
          c.longitude,
        ),
      };
    })
    .sort((a, b) => a.d - b.d)
    .map((x) => x.c);
}

function locationTier(subject: DealListingInput, candidate: DealListingInput): number {
  if (
    subject.zoneName &&
    candidate.zoneName &&
    subject.zoneName.trim().toLowerCase() === candidate.zoneName.trim().toLowerCase()
  ) {
    return 0;
  }
  if (
    subject.neighborhood &&
    candidate.neighborhood &&
    subject.neighborhood.trim().toLowerCase() ===
      candidate.neighborhood.trim().toLowerCase()
  ) {
    return 1;
  }
  return 2;
}

export function selectComps(
  subject: DealListingInput,
  pool: DealListingInput[],
  metricType: MetricType,
): { comps: DealListingInput[]; method: string } {
  const compatible = pool.filter((c) => compCompatible(subject, c, metricType));
  if (compatible.length === 0) {
    return { comps: [], method: "none" };
  }

  if (subject.latitude != null && subject.longitude != null) {
    const geoOrdered = geoSortedComps(subject, compatible);
    const near = geoOrdered.filter((c) => {
      if (c.latitude == null || c.longitude == null) return false;
      return (
        haversineMeters(
          subject.latitude!,
          subject.longitude!,
          c.latitude,
          c.longitude,
        ) <= GEO_RADIUS_M
      );
    });
    if (near.length >= MIN_RELAXED_SAMPLE) {
      return { comps: near.slice(0, 24), method: "geo_1km" };
    }
  }

  const byLocation = [...compatible].sort(
    (a, b) => locationTier(subject, a) - locationTier(subject, b),
  );
  const zone = byLocation.filter((c) => locationTier(subject, c) === 0);
  if (zone.length >= MIN_RELAXED_SAMPLE) {
    return { comps: zone.slice(0, 24), method: "zone" };
  }

  const nb = byLocation.filter((c) => locationTier(subject, c) <= 1);
  if (nb.length >= MIN_RELAXED_SAMPLE) {
    return { comps: nb.slice(0, 24), method: "neighborhood" };
  }

  return { comps: byLocation.slice(0, 24), method: "city" };
}

export function referencePpm2FromComps(
  comps: DealListingInput[],
  metricType: MetricType,
): number | null {
  const values = comps
    .map((c) => compPpm2(c, metricType))
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (values.length < MIN_RELAXED_SAMPLE) return null;
  const clipped = winsorizeByPercentile(values, 0.05);
  return median(clipped);
}

export function recentPriceDropPct(
  events: PriceEventInput[],
  currentPrice: number,
  withinDays = 60,
): number | null {
  if (events.length === 0 || currentPrice <= 0) return null;
  const cutoff = Date.now() - withinDays * 86400000;
  const inWindow = events.filter((e) => e.recordedAt.getTime() >= cutoff);
  if (inWindow.length === 0) return null;

  const maxPrior = Math.max(
    ...inWindow.map((e) => Number(e.priceCop)).filter((p) => p > currentPrice),
  );
  if (!Number.isFinite(maxPrior) || maxPrior <= currentPrice) return null;
  return ((maxPrior - currentPrice) / maxPrior) * 100;
}

function domDays(firstSeenAt: Date | null): number | null {
  if (!firstSeenAt) return null;
  return Math.max(0, (Date.now() - firstSeenAt.getTime()) / 86400000);
}

function computeConfidence(
  listing: DealListingInput,
  sampleSize: number,
  compMethod: string,
  extraReasons: string[],
  opts?: {
    discountVsRefPct?: number | null;
    belowPriceFloor?: boolean;
    compTypeMismatchRatio?: number;
    typeLocationMismatch?: boolean;
    terrainRisk?: boolean;
  },
): { confidence: ConfidenceLevel; reasons: string[] } {
  const reasons = [...extraReasons];
  let score = 100;

  if (!listing.propertyType) {
    score -= 20;
    reasons.push("missing_property_type");
  }
  if (!listing.neighborhood && !listing.zoneName) {
    score -= 15;
    reasons.push("missing_location");
  }
  if (!listing.sourceUpdatedAt) {
    score -= 10;
    reasons.push("missing_update_time");
  } else {
    const ageDays = (Date.now() - listing.sourceUpdatedAt.getTime()) / 86400000;
    if (ageDays > 45) {
      score -= 20;
      reasons.push("stale_listing");
    } else if (ageDays > 20) {
      score -= 10;
      reasons.push("aging_listing");
    }
  }
  if (listing.acceptsBarter) {
    score -= 12;
    reasons.push("accepts_barter_soft_price");
  }
  if (!hasMinSample(sampleSize)) {
    score -= 18;
    reasons.push("low_comp_sample");
  } else if (sampleSize < 12) {
    score -= 8;
    reasons.push("moderate_comp_sample");
  }
  if (compMethod === "city") {
    score -= 10;
    reasons.push("city_wide_comps");
  }

  const discount = opts?.discountVsRefPct ?? null;
  if (discount != null && discount > 50) {
    score -= 25;
    reasons.push("extreme_discount");
  }

  if (opts?.belowPriceFloor) {
    score -= 20;
    if (!reasons.includes("price_outlier")) reasons.push("price_outlier");
  }

  if (
    isTerrainLike(listing.propertyType) &&
    compMethod === "geo_1km" &&
    (opts?.compTypeMismatchRatio ?? 0) > 0.5
  ) {
    score -= 15;
    reasons.push("mixed_comp_property_types");
  }

  if (opts?.typeLocationMismatch) {
    score -= 18;
    if (!reasons.includes("type_location_mismatch")) {
      reasons.push("type_location_mismatch");
    }
  }

  if (opts?.terrainRisk) {
    score -= 14;
    if (!reasons.includes("terrain_risk")) {
      reasons.push("terrain_risk");
    }
  }

  let confidence: ConfidenceLevel;
  if (score >= 80) confidence = "high";
  else if (score >= 55) confidence = "medium";
  else confidence = "low";

  const blockHigh =
    (discount != null && discount > 50) || Boolean(opts?.belowPriceFloor);
  if (blockHigh && confidence === "high") {
    confidence = "medium";
  }

  return { confidence, reasons };
}

export function analyzeDeal(
  subject: DealListingInput,
  pool: DealListingInput[],
  opts?: {
    priceEvents?: PriceEventInput[];
    minBuiltPpm2ForHouse?: number;
    requirePositiveDiscount?: boolean;
  },
): DealAnalysis {
  const exclusionReasons = areaSanityExclude(
    subject,
    opts?.minBuiltPpm2ForHouse,
  );
  if (exclusionReasons.length > 0) {
    return {
      excluded: true,
      exclusionReasons,
      metricType: "generic",
      subjectPpm2: null,
      refPpm2: null,
      compSampleSize: 0,
      compMethod: "excluded",
      discountVsRefPct: null,
      dealScore: null,
      breakdown: null,
      confidence: "low",
      confidenceReasons: exclusionReasons,
      priceDropPct: null,
      domDays: domDays(subject.firstSeenAt),
    };
  }

  const { metricType, ppm2: subjectPpm2 } = pickSubjectMetric(subject);
  const { comps, method } = selectComps(subject, pool, metricType);
  const refPpm2 = referencePpm2FromComps(comps, metricType);
  const sampleSize = comps.length;

  const discountVsRefPct =
    subjectPpm2 != null && refPpm2 != null && refPpm2 > 0
      ? ((refPpm2 - subjectPpm2) / refPpm2) * 100
      : null;

  const stickerMedianReasons = stickerPriceMedianExclude(subject, comps);
  const priceReasons = priceSanityExclude(
    subject,
    metricType,
    subjectPpm2,
    discountVsRefPct,
  );
  const terrainFlags = descriptionTerrainFlags(subject.description);
  const hardExcludeReasons = Array.from(
    new Set([
      ...stickerMedianReasons,
      ...priceReasons.filter(
        (r) => r === "likely_missing_zeros" || r === "price_outlier",
      ),
      ...(isTerrainLike(subject.propertyType) && terrainFlags.shouldExclude
        ? ["terrain_risk"]
        : []),
    ]),
  );

  if (hardExcludeReasons.length > 0) {
    return {
      excluded: true,
      exclusionReasons: hardExcludeReasons,
      metricType,
      subjectPpm2,
      refPpm2,
      compSampleSize: sampleSize,
      compMethod: method,
      discountVsRefPct,
      dealScore: null,
      breakdown: null,
      confidence: "low",
      confidenceReasons: hardExcludeReasons,
      priceDropPct: null,
      domDays: domDays(subject.firstSeenAt),
    };
  }

  if (
    opts?.requirePositiveDiscount &&
    (discountVsRefPct == null || discountVsRefPct <= 0)
  ) {
    return {
      excluded: true,
      exclusionReasons: ["not_below_reference"],
      metricType,
      subjectPpm2,
      refPpm2,
      compSampleSize: sampleSize,
      compMethod: method,
      discountVsRefPct,
      dealScore: null,
      breakdown: null,
      confidence: "low",
      confidenceReasons: ["not_below_reference"],
      priceDropPct: null,
      domDays: domDays(subject.firstSeenAt),
    };
  }

  const currentPrice = Number(subject.priceCop);
  const priceDropPct = opts?.priceEvents
    ? recentPriceDropPct(opts.priceEvents, currentPrice)
    : null;
  const dom = domDays(subject.firstSeenAt);

  const baseScore = dealScore(
    subjectPpm2,
    refPpm2,
    subject.sourceUpdatedAt,
    subject.dataCompletenessScore,
  );

  const relDiscount =
    subjectPpm2 != null && refPpm2 != null && refPpm2 > 0
      ? Math.max(-1, Math.min(1, (refPpm2 - subjectPpm2) / refPpm2))
      : 0;
  const ageDays = subject.sourceUpdatedAt
    ? Math.max(0, (Date.now() - subject.sourceUpdatedAt.getTime()) / 86400000)
    : 30;
  const freshnessComponent = Math.max(0, 1 - Math.min(ageDays / 30, 1)) * 12;
  const completenessComponent =
    Math.max(0, Math.min(1, subject.dataCompletenessScore ?? 0)) * 8;
  const discountComponent = relDiscount * 80;

  let priceDropBonus = 0;
  if (priceDropPct != null) {
    if (priceDropPct >= 10) priceDropBonus = 5;
    else if (priceDropPct >= 5) priceDropBonus = 3;
    else if (priceDropPct >= 2) priceDropBonus = 1;
  }

  let domBonus = 0;
  if (dom != null && dom >= 90 && (discountVsRefPct ?? 0) > 0) domBonus = 2;
  else if (dom != null && dom >= 60 && (discountVsRefPct ?? 0) > 0) domBonus = 1;

  const barterPenalty = subject.acceptsBarter ? 12 : 0;
  const projectPenalty = subject.isProject ? 8 : 0;
  const promotedPenalty =
    subject.paidQuota || (subject.highlight != null && subject.highlight > 0)
      ? 5
      : 0;
  const lowSamplePenalty = hasMinSample(sampleSize) ? 0 : 6;

  let highAdminPenalty = 0;
  const admin = subject.adminFeeCop != null ? Number(subject.adminFeeCop) : null;
  if (admin != null && admin >= 2_500_000) highAdminPenalty = 2;

  const typeLocationReasons = typeLocationMismatchReasons(subject);
  const typeLocationMismatch = typeLocationReasons.length > 0;
  const typeLocationPenalty = typeLocationMismatch ? 12 : 0;

  let terrainRiskPenalty = 0;
  if (isTerrainLike(subject.propertyType) && terrainFlags.hasRisk) {
    terrainRiskPenalty = 10;
  }

  const belowPriceFloor = isBelowPriceFloor(subject, subjectPpm2, metricType);
  const compTypeMismatchRatio = compPropertyTypeMismatchRatio(subject, comps);

  const breakdown: DealScoreBreakdown = {
    discountComponent: Number(discountComponent.toFixed(4)),
    freshnessComponent: Number(freshnessComponent.toFixed(4)),
    completenessComponent: Number(completenessComponent.toFixed(4)),
    priceDropBonus,
    domBonus,
    barterPenalty,
    projectPenalty,
    promotedPenalty,
    lowSamplePenalty,
    highAdminPenalty,
    terrainRiskPenalty,
    typeLocationPenalty,
    priceSanityPenalty: 0,
  };

  const rawScore =
    baseScore == null
      ? null
      : discountComponent +
        freshnessComponent +
        completenessComponent +
        priceDropBonus +
        domBonus -
        barterPenalty -
        projectPenalty -
        promotedPenalty -
        lowSamplePenalty -
        highAdminPenalty -
        terrainRiskPenalty -
        typeLocationPenalty;

  const dealScoreValue =
    rawScore == null ? null : Number(Math.max(0, rawScore).toFixed(4));

  const { confidence, reasons } = computeConfidence(
    subject,
    sampleSize,
    method,
    typeLocationReasons,
    {
      discountVsRefPct,
      belowPriceFloor,
      compTypeMismatchRatio,
      typeLocationMismatch,
      terrainRisk: isTerrainLike(subject.propertyType) && terrainFlags.hasRisk,
    },
  );

  return {
    excluded: false,
    exclusionReasons: [],
    metricType,
    subjectPpm2,
    refPpm2,
    compSampleSize: sampleSize,
    compMethod: method,
    discountVsRefPct,
    dealScore: dealScoreValue,
    breakdown,
    confidence,
    confidenceReasons: reasons,
    priceDropPct,
    domDays: dom,
  };
}

export function toDealListingInput(
  row: Record<string, unknown>,
): DealListingInput {
  return {
    id: String(row.id),
    externalId: row.externalId != null ? String(row.externalId) : undefined,
    city: String(row.city ?? ""),
    neighborhood: (row.neighborhood as string | null) ?? null,
    zoneName: (row.zoneName as string | null) ?? null,
    propertyType: (row.propertyType as string | null) ?? null,
    constructionState: (row.constructionState as string | null) ?? null,
    estrato: (row.estrato as number | null) ?? null,
    operationType: (row.operationType as string | null) ?? null,
    areaM2: Number(row.areaM2 ?? 0),
    areaBuiltM2: (row.areaBuiltM2 as number | null) ?? null,
    areaPrivateM2: (row.areaPrivateM2 as number | null) ?? null,
    areaTerrainM2: (row.areaTerrainM2 as number | null) ?? null,
    areaTerraceM2: (row.areaTerraceM2 as number | null) ?? null,
    priceCop: row.priceCop as bigint | number,
    pricePerM2: (row.pricePerM2 as number | null) ?? null,
    pricePerM2Built: (row.pricePerM2Built as number | null) ?? null,
    pricePerM2Private: (row.pricePerM2Private as number | null) ?? null,
    pricePerM2Terrain: (row.pricePerM2Terrain as number | null) ?? null,
    priceAdminIncluded: (row.priceAdminIncluded as bigint | number | null) ?? null,
    adminFeeCop: (row.adminFeeCop as bigint | number | null) ?? null,
    bedrooms: (row.bedrooms as number | null) ?? null,
    bathrooms: (row.bathrooms as number | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    sourceUpdatedAt: (row.sourceUpdatedAt as Date | null) ?? null,
    firstSeenAt: (row.firstSeenAt as Date | null) ?? null,
    dataCompletenessScore: (row.dataCompletenessScore as number | null) ?? null,
    acceptsBarter: Boolean(row.acceptsBarter),
    terraceHeavyFlag: Boolean(row.terraceHeavyFlag),
    areaMismatchFlag: Boolean(row.areaMismatchFlag),
    isProject: Boolean(row.isProject),
    paidQuota: (row.paidQuota as boolean | null) ?? null,
    highlight: (row.highlight as number | null) ?? null,
    description: (row.description as string | null) ?? null,
  };
}

export { MIN_SAMPLE_SIZE };
