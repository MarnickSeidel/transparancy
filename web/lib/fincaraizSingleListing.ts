import { createHash } from "crypto";

type Json = Record<string, unknown>;

export type ParsedListing = {
  externalId: string;
  url: string;
  title: string;
  priceCop: number;
  areaM2: number;
  areaBuiltM2: number | null;
  areaTerrainM2: number | null;
  estrato: number | null;
  neighborhood: string | null;
  city: string;
  department: string;
  propertyType: string | null;
  operationType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  description: string | null;
  locationPath: string[];
  sourceFingerprint: string;
};

const ALLOWED_HOSTS = new Set(["www.fincaraiz.com.co", "fincaraiz.com.co"]);

function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const digits = v.replace(/[^\d.,]/g, "").trim();
  if (!digits) return null;
  const normalized = digits.includes(",") && digits.includes(".")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(v: unknown): number | null {
  const n = parseNumber(v);
  if (n == null) return null;
  return Math.round(n);
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractExternalIdFromUrl(url: string): string | null {
  const m = url.match(/\/(\d+)(?:[/?#]|$)/);
  return m ? m[1] : null;
}

function normalizeUrl(input: string): URL {
  const u = new URL(input.trim());
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
    throw new Error("url_not_allowed");
  }
  u.hash = "";
  u.search = "";
  return u;
}

export function validateFincaraizUrl(input: string): string {
  const u = normalizeUrl(input);
  if (!/^\/[a-z0-9-]+\/\d+$/i.test(u.pathname.replace(/\/+$/, ""))) {
    throw new Error("url_path_invalid");
  }
  return u.toString();
}

export async function fetchHtmlWithTimeout(
  url: string,
  timeoutMs = 15000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error("fetch_failed");
    return await res.text();
  } catch {
    throw new Error("fetch_failed");
  } finally {
    clearTimeout(timer);
  }
}

function extractNextData(html: string): Json {
  const m = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) throw new Error("next_data_missing");
  return JSON.parse(m[1]) as Json;
}

function asObject(v: unknown): Json | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}

function detailItemFromNextData(nextData: Json): Json | null {
  const props = asObject(nextData.props);
  const pageProps = props ? asObject(props.pageProps) : null;
  const data = pageProps ? asObject(pageProps.data) : null;
  return data;
}

function crawlObjects(node: unknown, out: Json[], depth = 0) {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) crawlObjects(n, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Json;
    out.push(obj);
    for (const v of Object.values(obj)) crawlObjects(v, out, depth + 1);
  }
}

function pickBestObject(nextData: Json): Json {
  const objects: Json[] = [];
  crawlObjects(nextData, objects);
  let best: Json | null = null;
  let bestScore = -1;
  for (const o of objects) {
    let score = 0;
    if (typeof o.title === "string") score += 2;
    if (o.price != null || o.price_value != null) score += 2;
    if (o.description != null) score += 1;
    if (o.property_type != null || o.propertyType != null) score += 1;
    if (o.bedrooms != null || o.bathrooms != null) score += 1;
    if (o.locations != null || o.neighbourhood != null) score += 1;
    if (o.code != null || o.id != null) score += 1;
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  if (!best) throw new Error("listing_payload_missing");
  return best;
}

function extractLocationPath(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseFromDescription(desc: string | null) {
  if (!desc) return { areaBuiltM2: null as number | null, areaTerrainM2: null as number | null };
  const built = desc.match(/(\d[\d.,]*)\s*(?:m2|mts2|m²)\s*(?:de\s+ellos\s+)?construid/i);
  const terrain = desc.match(/(?:area\s+total|terreno)[^\d]{0,20}(\d[\d.,]*)\s*(?:m2|mts2|m²)/i);
  return {
    areaBuiltM2: built ? parseNumber(built[1]) : null,
    areaTerrainM2: terrain ? parseNumber(terrain[1]) : null,
  };
}

export function parseSingleListingFromHtml(inputUrl: string, html: string): ParsedListing {
  const canonical = validateFincaraizUrl(inputUrl);
  const nextData = extractNextData(html);
  const item = detailItemFromNextData(nextData) ?? pickBestObject(nextData);

  const title = (typeof item.title === "string" ? item.title.trim() : "Listing").slice(0, 300);
  const description =
    typeof item.description === "string" ? item.description.slice(0, 8000) : null;
  const propertyType =
    typeof item.property_type === "string"
      ? item.property_type
      : typeof (item.property_type as Json | undefined)?.name === "string"
        ? ((item.property_type as Json).name as string)
      : typeof item.propertyType === "string"
        ? item.propertyType
        : null;
  const operationType =
    typeof item.business_type === "string"
      ? item.business_type
      : typeof (item.operation_type as Json | undefined)?.name === "string"
        ? ((item.operation_type as Json).name as string)
      : typeof item.operationType === "string"
        ? item.operationType
        : "Venta";

  let priceCop =
    parseIntSafe((item.price as Json | undefined)?.["amount"]) ??
    parseIntSafe(item.price) ??
    parseIntSafe((item as Json).price_value);
  if (priceCop == null && description) {
    const m = description.match(/\$\s*([\d.]+)/);
    if (m) priceCop = parseIntSafe(m[1]);
  }
  if (priceCop == null || priceCop <= 0) throw new Error("price_missing");

  const areaM2 =
    parseNumber((item as Json).area) ??
    parseNumber((item as Json).area_m2) ??
    parseNumber((item as Json).private_area) ??
    parseNumber((item as Json).m2) ??
    parseNumber((item as Json).m2apto) ??
    parseNumber((item as Json).built_area);
  if (areaM2 == null || areaM2 <= 0) throw new Error("area_missing");

  let areaBuiltM2 =
    parseNumber((item as Json).built_area) ??
    parseNumber((item as Json).area_built) ??
    parseNumber((item as Json).m2Built) ??
    null;
  let areaTerrainM2 =
    parseNumber((item as Json).terrain_area) ??
    parseNumber((item as Json).area_terrain) ??
    parseNumber((item as Json).m2Terrain) ??
    null;

  const parsedDesc = parseFromDescription(description);
  areaBuiltM2 = areaBuiltM2 ?? parsedDesc.areaBuiltM2;
  areaTerrainM2 = areaTerrainM2 ?? parsedDesc.areaTerrainM2;

  const locations = (item as Json).locations as Json | undefined;
  const locationMain = asObject(locations?.location_main);
  const cityObj = asObject(locations?.city);
  const stateObj = asObject(locations?.state);
  const path = extractLocationPath((item as Json).location_path);
  const city =
    (typeof locations?.city === "string" ? locations.city : null) ??
    (typeof cityObj?.name === "string" ? (cityObj.name as string) : null) ??
    (path.length >= 2 ? path[path.length - 2] : null) ??
    "Pereira";
  const department =
    (typeof locations?.state === "string" ? locations.state : null) ??
    (typeof stateObj?.name === "string" ? (stateObj.name as string) : null) ??
    (path.length >= 1 ? path[path.length - 1] : null) ??
    "Risaralda";

  const neighborhood =
    typeof (item as Json).neighborhood === "string"
      ? ((item as Json).neighborhood as string)
      : typeof (item as Json).neighbourhood === "string"
        ? ((item as Json).neighbourhood as string)
        : typeof locationMain?.name === "string"
          ? (locationMain.name as string)
        : null;

  const estrato = parseIntSafe((item as Json).stratum);
  const bedrooms = parseIntSafe((item as Json).bedrooms);
  const bathrooms = parseIntSafe((item as Json).bathrooms);
  const latitude = parseNumber((item as Json).latitude);
  const longitude = parseNumber((item as Json).longitude);
  const imageUrl =
    typeof (item as Json).image === "string"
      ? ((item as Json).image as string)
      : typeof (item as Json).imageUrl === "string"
        ? ((item as Json).imageUrl as string)
        : null;

  const externalId =
    (typeof (item as Json).code === "string" ? (item as Json).code as string : null) ??
    extractExternalIdFromUrl(canonical) ??
    createHash("sha1").update(canonical).digest("hex").slice(0, 16);

  const fingerprint = createHash("sha1")
    .update(`${canonical}|${title}|${priceCop}|${areaM2}`)
    .digest("hex");

  return {
    externalId: externalId.trim(),
    url: canonical,
    title,
    priceCop,
    areaM2,
    areaBuiltM2,
    areaTerrainM2,
    estrato,
    neighborhood: neighborhood ? titleCase(neighborhood.trim()) : null,
    city: titleCase(String(city).trim() || "Pereira"),
    department: titleCase(String(department).trim() || "Risaralda"),
    propertyType: propertyType ? titleCase(propertyType.trim()) : null,
    operationType: operationType ? titleCase(operationType.trim()) : null,
    bedrooms,
    bathrooms,
    latitude,
    longitude,
    imageUrl,
    description,
    locationPath: path,
    sourceFingerprint: fingerprint,
  };
}
