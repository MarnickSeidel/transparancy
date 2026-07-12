/**
 * Quick sanity checks for dealEngine. Run: npx tsx scripts/dealEngineSanity.ts
 */
import {
  analyzeDeal,
  pickSubjectMetric,
  referencePpm2FromComps,
  selectComps,
  type DealListingInput,
} from "../lib/dealEngine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function base(
  overrides: Partial<DealListingInput> & Pick<DealListingInput, "id">,
): DealListingInput {
  return {
    id: overrides.id,
    city: "Pereira",
    neighborhood: "Centro",
    zoneName: null,
    propertyType: "Apartamento",
    constructionState: "Usado",
    estrato: 4,
    operationType: "Venta",
    areaM2: 80,
    areaBuiltM2: 80,
    areaPrivateM2: 72,
    areaTerrainM2: null,
    areaTerraceM2: 8,
    priceCop: 200_000_000,
    pricePerM2: 2_500_000,
    pricePerM2Built: 2_500_000,
    pricePerM2Private: 2_777_777,
    pricePerM2Terrain: null,
    priceAdminIncluded: null,
    adminFeeCop: null,
    bedrooms: 3,
    bathrooms: 2,
    latitude: 4.813,
    longitude: -75.696,
    sourceUpdatedAt: new Date(),
    firstSeenAt: new Date(Date.now() - 30 * 86400000),
    dataCompletenessScore: 0.8,
    acceptsBarter: false,
    terraceHeavyFlag: false,
    areaMismatchFlag: false,
    isProject: false,
    paidQuota: false,
    highlight: null,
    description: null,
    ...overrides,
  };
}

function comp(id: string, ppm2Private: number, lat: number, lng: number): DealListingInput {
  return base({
    id,
    priceCop: Math.round(ppm2Private * 72),
    pricePerM2Private: ppm2Private,
    pricePerM2: ppm2Private,
    latitude: lat,
    longitude: lng,
  });
}

function houseComp(
  id: string,
  priceCop: number,
  ppm2Built: number,
  lat: number,
  lng: number,
): DealListingInput {
  return base({
    id,
    propertyType: "Casa",
    areaM2: 250,
    areaBuiltM2: 250,
    areaPrivateM2: null,
    priceCop,
    pricePerM2Built: ppm2Built,
    pricePerM2: ppm2Built,
    pricePerM2Private: null,
    bedrooms: 4,
    bathrooms: 3,
    latitude: lat,
    longitude: lng,
  });
}

// --- Normal apartment deal still scores ---
const subject = base({ id: "subj", pricePerM2Private: 2_000_000, priceCop: 144_000_000 });
const pool = [
  subject,
  ...Array.from({ length: 6 }, (_, i) =>
    comp(`c${i}`, 2_800_000 + i * 10_000, 4.813 + i * 0.001, -75.696),
  ),
];

const picked = pickSubjectMetric(subject);
assert(picked.metricType === "private", "apartment should use private metric");

const { comps, method } = selectComps(subject, pool, "private");
assert(comps.length >= 4, "should find comps");
assert(method === "geo_1km" || method === "zone", "expected geo or zone comps");

const ref = referencePpm2FromComps(comps, "private");
assert(ref != null && ref > subject.pricePerM2Private!, "ref should exceed subject");

const analysis = analyzeDeal(subject, pool, { requirePositiveDiscount: true });
assert(!analysis.excluded, "subject below ref should not be excluded");
assert(
  analysis.discountVsRefPct != null && analysis.discountVsRefPct > 0,
  "positive discount expected",
);
assert(analysis.dealScore != null && analysis.dealScore > 0, "positive deal score");
assert(analysis.confidence !== "low", "normal deal should not be low confidence");

// --- Fake low-price casa (missing zeros) excluded ---
const fakeCasa = base({
  id: "cerritos",
  propertyType: "Casa",
  areaM2: 320,
  areaBuiltM2: 320,
  areaPrivateM2: null,
  priceCop: 1_120_000,
  pricePerM2Built: 3_500,
  pricePerM2: 3_500,
  pricePerM2Private: null,
  bedrooms: 5,
  bathrooms: 4,
});

const casaPool = [
  fakeCasa,
  ...Array.from({ length: 6 }, (_, i) =>
    houseComp(
      `hc${i}`,
      1_120_000_000,
      3_500_000 + i * 50_000,
      4.813 + i * 0.001,
      -75.696,
    ),
  ),
];

const fakeAnalysis = analyzeDeal(fakeCasa, casaPool, { requirePositiveDiscount: true });
assert(fakeAnalysis.excluded, "fake low-price casa should be excluded");
assert(
  fakeAnalysis.exclusionReasons.includes("likely_missing_zeros"),
  `expected likely_missing_zeros, got ${fakeAnalysis.exclusionReasons.join(",")}`,
);

// --- Steep lote downranked via terrain_risk ---
const steepLote = base({
  id: "empinado",
  propertyType: "Lote",
  areaM2: 1200,
  areaBuiltM2: null,
  areaPrivateM2: null,
  areaTerrainM2: 1200,
  priceCop: 180_000_000,
  pricePerM2Terrain: 150_000,
  pricePerM2: 150_000,
  pricePerM2Built: null,
  pricePerM2Private: null,
  description: "Lote empinado con pendiente pronunciada, acceso difícil.",
  estrato: 3,
});

const lotePool = [
  steepLote,
  ...Array.from({ length: 6 }, (_, i) =>
    base({
      id: `lt${i}`,
      propertyType: "Lote",
      areaM2: 1100 + i * 50,
      areaTerrainM2: 1100 + i * 50,
      areaBuiltM2: null,
      areaPrivateM2: null,
      priceCop: 220_000_000 + i * 5_000_000,
      pricePerM2Terrain: 200_000 + i * 5_000,
      pricePerM2: 200_000 + i * 5_000,
      pricePerM2Built: null,
      pricePerM2Private: null,
      latitude: 4.813 + i * 0.001,
      longitude: -75.696,
    }),
  ),
];

const steepAnalysis = analyzeDeal(steepLote, lotePool, { requirePositiveDiscount: true });
assert(!steepAnalysis.excluded, "steep lote should not hard-exclude");
assert(
  steepAnalysis.confidenceReasons.includes("terrain_risk"),
  "steep lote should flag terrain_risk",
);
assert(
  steepAnalysis.confidence !== "high",
  "steep lote should be downranked from high confidence",
);
assert(
  (steepAnalysis.breakdown?.terrainRiskPenalty ?? 0) > 0,
  "steep lote should apply terrain penalty",
);

console.log("dealEngine sanity: OK", {
  normal: {
    metric: analysis.metricType,
    discount: analysis.discountVsRefPct?.toFixed(1),
    score: analysis.dealScore,
    confidence: analysis.confidence,
  },
  fakeCasa: fakeAnalysis.exclusionReasons,
  steepLote: {
    confidence: steepAnalysis.confidence,
    reasons: steepAnalysis.confidenceReasons,
    penalty: steepAnalysis.breakdown?.terrainRiskPenalty,
  },
});
