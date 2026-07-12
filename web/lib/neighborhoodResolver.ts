import bogotaCatalog from "@/data/neighborhoods/bogota.json";
import caliCatalog from "@/data/neighborhoods/cali.json";
import manizalesCatalog from "@/data/neighborhoods/manizales.json";
import medellinCatalog from "@/data/neighborhoods/medellin.json";
import pereiraCatalog from "@/data/neighborhoods/pereira.json";

import { normalizeNeighborhoodKey } from "./neighborhoods";

export type NeighborhoodConfidence =
  | "catalog"
  | "source_id"
  | "provisional"
  | "weak"
  | "missing";

export const CONFIDENCE_RANK: Record<NeighborhoodConfidence, number> = {
  catalog: 5,
  source_id: 4,
  provisional: 3,
  weak: 2,
  missing: 1,
};

export const PROVISIONAL_MIN_PEERS = 20;

export type NeighborhoodResolution = {
  neighborhood: string | null;
  confidence: NeighborhoodConfidence;
  dossierKey: string | null;
  compZone: string | null;
};

type CatalogFile = {
  city_key: string;
  neighborhoods?: string[];
  aliases?: Record<string, string>;
  source_ids?: Record<string, string>;
};

const CATALOGS: Record<string, CatalogFile> = {
  bogota: bogotaCatalog as CatalogFile,
  cali: caliCatalog as CatalogFile,
  manizales: manizalesCatalog as CatalogFile,
  medellin: medellinCatalog as CatalogFile,
  pereira: pereiraCatalog as CatalogFile,
};

const ADDRESS_TOKEN_RE =
  /\b(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\b/gi;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/nº|n°|°/g, "no")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFoldMaps(cityKey: string): {
  foldToCanonical: Map<string, string>;
  sourceIdToCanonical: Map<string, string>;
} {
  const catalog = CATALOGS[cityKey];
  const foldToCanonical = new Map<string, string>();
  const sourceIdToCanonical = new Map<string, string>();
  if (!catalog) {
    return { foldToCanonical, sourceIdToCanonical };
  }
  for (const name of catalog.neighborhoods ?? []) {
    foldToCanonical.set(fold(name), name);
  }
  for (const [alias, target] of Object.entries(catalog.aliases ?? {})) {
    foldToCanonical.set(fold(alias), target);
  }
  for (const [sid, target] of Object.entries(catalog.source_ids ?? {})) {
    sourceIdToCanonical.set(sid.trim(), target);
  }
  return { foldToCanonical, sourceIdToCanonical };
}

export function catalogKeyForCity(
  city: string | null | undefined,
  citySlug?: string | null,
): string | null {
  if (citySlug) {
    const sk = fold(citySlug.replace("city-colombia-", "").replace(/_/g, "-"));
    if (CATALOGS[sk]) return sk;
  }
  if (city) {
    const ck = fold(city);
    if (CATALOGS[ck]) return ck;
  }
  return null;
}

export function isRuralLocation(
  locationType?: string | null,
  slug?: string | null,
): boolean {
  const lt = (locationType ?? "").trim().toLowerCase();
  const sl = (slug ?? "").trim().toLowerCase();
  return (
    lt.includes("rural") ||
    lt === "rural_neighbourhood" ||
    lt === "rural_neighborhood" ||
    sl.includes("rural")
  );
}

function applyRuralSuffix(canonical: string, rural: boolean): string {
  if (!rural) return canonical;
  if (canonical.toLowerCase().endsWith(" rural")) return canonical;
  return `${canonical} rural`;
}

function cleanLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, 200) : null;
}

function resolveExactInCatalog(
  raw: string,
  cityKey: string,
  rural: boolean,
): string | null {
  const { foldToCanonical } = buildFoldMaps(cityKey);
  const hit = foldToCanonical.get(fold(raw));
  if (!hit) return null;
  if (rural) {
    const ruralHit =
      foldToCanonical.get(`${fold(raw)} rural`) ??
      foldToCanonical.get(fold(`${hit} rural`));
    return ruralHit ?? `${hit} rural`;
  }
  return hit;
}

export function buildDossierKey(args: {
  city?: string | null;
  citySlug?: string | null;
  neighborhood?: string | null;
  neighborhoodSourceId?: string | null;
  rural?: boolean;
}): string | null {
  const ck =
    catalogKeyForCity(args.city, args.citySlug) ??
    (args.city ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!ck) return null;
  if (args.neighborhoodSourceId?.trim()) {
    return `${ck}:uuid:${args.neighborhoodSourceId.trim()}`;
  }
  if (args.neighborhood?.trim()) {
    let nk = normalizeNeighborhoodKey(args.neighborhood);
    if (!nk) return null;
    if (args.rural) nk = `${nk}-rural`;
    return `${ck}:${nk}`;
  }
  return null;
}

export function resolveNeighborhood(args: {
  candidates: Array<string | null | undefined>;
  city?: string | null;
  citySlug?: string | null;
  neighborhoodSourceId?: string | null;
  sourceLocationName?: string | null;
  locationType?: string | null;
  locationSlug?: string | null;
  zoneName?: string | null;
  peerCounts?: Record<string, number>;
}): NeighborhoodResolution {
  const rural = isRuralLocation(args.locationType, args.locationSlug);
  const cityKey = catalogKeyForCity(args.city, args.citySlug);
  const compZone = cleanLabel(args.zoneName);
  const cleaned = args.candidates
    .map((c) => cleanLabel(c))
    .filter((c): c is string => Boolean(c));

  if (args.neighborhoodSourceId?.trim()) {
    const sid = args.neighborhoodSourceId.trim();
    if (cityKey) {
      const { sourceIdToCanonical } = buildFoldMaps(cityKey);
      const fromId = sourceIdToCanonical.get(sid);
      if (fromId) {
        const canonical = applyRuralSuffix(fromId, rural);
        return {
          neighborhood: canonical,
          confidence: "catalog",
          dossierKey: buildDossierKey({
            city: args.city,
            citySlug: args.citySlug,
            neighborhood: canonical,
            neighborhoodSourceId: sid,
            rural,
          }),
          compZone,
        };
      }
    }
    const frName = cleanLabel(args.sourceLocationName);
    if (frName) {
      let canonical = frName;
      let confidence: NeighborhoodConfidence = "source_id";
      if (cityKey) {
        const catalogHit = resolveExactInCatalog(frName, cityKey, rural);
        if (catalogHit) {
          canonical = catalogHit;
          confidence = "catalog";
        } else {
          canonical = applyRuralSuffix(canonical, rural);
        }
      } else {
        canonical = applyRuralSuffix(canonical, rural);
      }
      return {
        neighborhood: canonical,
        confidence,
        dossierKey: buildDossierKey({
          city: args.city,
          citySlug: args.citySlug,
          neighborhood: canonical,
          neighborhoodSourceId: sid,
          rural,
        }),
        compZone,
      };
    }
  }

  if (cityKey) {
    for (const cand of cleaned) {
      const hit = resolveExactInCatalog(cand, cityKey, rural);
      if (hit) {
        return {
          neighborhood: hit,
          confidence: "catalog",
          dossierKey: buildDossierKey({
            city: args.city,
            citySlug: args.citySlug,
            neighborhood: hit,
            rural,
          }),
          compZone,
        };
      }
    }
  }

  if (args.peerCounts && cleaned.length > 0) {
    let bestLabel: string | null = null;
    let bestCount = 0;
    for (const cand of cleaned) {
      let key = normalizeNeighborhoodKey(cand);
      if (rural) key = `${key}-rural`;
      const count = args.peerCounts[key] ?? 0;
      if (count >= PROVISIONAL_MIN_PEERS && count > bestCount) {
        bestCount = count;
        bestLabel = applyRuralSuffix(cand, rural);
      }
    }
    if (bestLabel) {
      return {
        neighborhood: bestLabel,
        confidence: "provisional",
        dossierKey: buildDossierKey({
          city: args.city,
          citySlug: args.citySlug,
          neighborhood: bestLabel,
          rural,
        }),
        compZone,
      };
    }
  }

  return {
    neighborhood: null,
    confidence: cleaned.length > 0 ? "weak" : "missing",
    dossierKey: null,
    compZone,
  };
}

export function confidenceRank(
  confidence: NeighborhoodConfidence | string | null | undefined,
): number {
  if (!confidence || !(confidence in CONFIDENCE_RANK)) {
    return CONFIDENCE_RANK.missing;
  }
  return CONFIDENCE_RANK[confidence as NeighborhoodConfidence];
}

export function mergeQualityFlags(
  existing: Record<string, unknown> | null | undefined,
  resolution: NeighborhoodResolution,
): Record<string, unknown> {
  const flags: Record<string, unknown> = { ...(existing ?? {}) };
  flags.neighborhood_confidence = resolution.confidence;
  flags.missing_neighborhood = resolution.neighborhood == null;
  if (resolution.dossierKey) {
    flags.dossier_key = resolution.dossierKey;
  }
  return flags;
}
