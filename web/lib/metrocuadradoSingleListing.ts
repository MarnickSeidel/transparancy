import { createHash } from "crypto"

import type { ParsedListing } from "@/lib/fincaraizSingleListing"

type Json = Record<string, unknown>

const ALLOWED_HOSTS = new Set(["www.metrocuadrado.com", "metrocuadrado.com"])

const CITY_DEPARTMENT: Record<string, string> = {
  pereira: "Risaralda",
  dosquebradas: "Risaralda",
  armenia: "Quindío",
  manizales: "Caldas",
  bogota: "Cundinamarca",
  "bogotá": "Cundinamarca",
  medellin: "Antioquia",
  "medellín": "Antioquia",
  cali: "Valle del Cauca",
  barranquilla: "Atlántico",
  cartagena: "Bolívar",
  bucaramanga: "Santander",
}

const parseNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v !== "string") return null
  const digits = v.replace(/[^\d.,]/g, "").trim()
  if (!digits) return null
  const normalized =
    digits.includes(",") && digits.includes(".")
      ? digits.replace(/\./g, "").replace(",", ".")
      : digits.replace(",", ".")
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

const parseIntSafe = (v: unknown): number | null => {
  const n = parseNumber(v)
  if (n == null) return null
  return Math.round(n)
}

const titleCase = (s: string): string =>
  s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")

export const extractMetrocuadradoIdFromUrl = (url: string): string | null => {
  const m = url.match(/\/(MC\d+)(?:[/?#]|$)/i)
  return m ? m[1].toUpperCase() : null
}

const normalizeUrl = (input: string): URL => {
  const u = new URL(input.trim())
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
    throw new Error("url_not_allowed")
  }
  u.hash = ""
  u.search = ""
  return u
}

export const validateMetrocuadradoUrl = (input: string): string => {
  const u = normalizeUrl(input)
  const path = u.pathname.replace(/\/+$/, "")
  if (!/^\/inmueble\/[^/]+\/MC\d+$/i.test(path)) {
    throw new Error("url_path_invalid")
  }
  const id = extractMetrocuadradoIdFromUrl(path)
  if (!id) throw new Error("url_path_invalid")
  // Canonical path casing for the property id
  u.pathname = path.replace(/MC\d+$/i, id)
  return u.toString()
}

export const isMetrocuadradoHost = (hostname: string): boolean =>
  ALLOWED_HOSTS.has(hostname.toLowerCase()) ||
  hostname.toLowerCase().endsWith(".metrocuadrado.com")

const unescapeFlightChunk = (chunk: string): string => {
  try {
    return JSON.parse(`"${chunk}"`) as string
  } catch {
    return chunk
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
  }
}

const tryParseObjectAt = (source: string, start: number): Json | null => {
  if (source[start] !== "{") return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth += 1
    else if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1)) as Json
        } catch {
          return null
        }
      }
    }
  }
  return null
}

const namedString = (v: unknown): string | null => {
  if (typeof v === "string") {
    const s = v.trim()
    return s || null
  }
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    const obj = v as Json
    for (const key of ["nombre", "name", "label", "title"]) {
      if (typeof obj[key] === "string") {
        const s = (obj[key] as string).trim()
        if (s) return s
      }
    }
  }
  return null
}

const extractFlightPayloads = (html: string): string[] => {
  const out: string[] = [html]
  const re = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    out.push(unescapeFlightChunk(m[1]))
  }
  return out
}

const extractPropertyObject = (html: string, propertyId: string): Json | null => {
  const needles = [
    `"propertyId":"${propertyId}"`,
    `\\"propertyId\\":\\"${propertyId}\\"`,
  ]
  for (const hay of extractFlightPayloads(html)) {
    for (const needle of needles) {
      let from = 0
      while (from < hay.length) {
        const idx = hay.indexOf(needle, from)
        if (idx < 0) break
        from = idx + needle.length
        const dataMarker = hay.lastIndexOf('"data":', idx)
        const startCandidates = [
          dataMarker >= 0 ? dataMarker + '"data":'.length : -1,
          hay.lastIndexOf("{", idx),
        ].filter((n) => n >= 0)
        for (const start of startCandidates) {
          // skip whitespace
          let s = start
          while (s < hay.length && /\s/.test(hay[s])) s += 1
          const parsed = tryParseObjectAt(hay, s)
          if (!parsed) continue
          const id = typeof parsed.propertyId === "string" ? parsed.propertyId : null
          if (id?.toUpperCase() !== propertyId) continue
          if (parsed.salePrice == null && parsed.rentPrice == null) continue
          return parsed
        }
      }
    }
  }
  return null
}

const parseFromSsrFallback = (html: string, propertyId: string, canonical: string): ParsedListing => {
  const priceMatch =
    html.match(/\$\s*([\d.]+(?:\.[\d]{3})*)/) ??
    html.match(/salePrice["\\]*:\s*(\d+)/)
  const areaMatch =
    html.match(/Área Construida\s*([\d.,]+)\s*m/i) ??
    html.match(/"area"\s*:\s*([\d.]+)/)
  const estratoMatch = html.match(/Estrato\s*(\d+)/i)
  const cityMatch =
    html.match(/,\s*([A-Za-zÁÉÍÓÚáéíóúñÑ ]+)<\/div>/) ??
    html.match(/Pereira|Medellín|Bogotá|Cali|Barranquilla/i)
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const neighborhoodMatch =
    html.match(/Barrio común:\s*([^<]+)/i) ??
    html.match(/Apartamento en Venta,\s*([^,<]+)/i)

  const priceCop = parseIntSafe(priceMatch?.[1] ?? null)
  const areaM2 = parseNumber(areaMatch?.[1] ?? null)
  if (priceCop == null || priceCop <= 0) throw new Error("price_missing")
  if (areaM2 == null || areaM2 <= 0) throw new Error("area_missing")

  const cityRaw = cityMatch?.[1]?.trim()
  if (!cityRaw) throw new Error("city_missing")
  const city = titleCase(cityRaw.replace(/\s+/g, " "))
  const department =
    CITY_DEPARTMENT[city.toLowerCase()] ?? "Colombia"
  const title = (titleMatch?.[1]?.trim() || `Inmueble ${propertyId}`).slice(0, 300)
  const neighborhood = neighborhoodMatch?.[1]
    ? titleCase(neighborhoodMatch[1].replace(/\s+/g, " ").trim())
    : null

  const fingerprint = createHash("sha1")
    .update(`${canonical}|${title}|${priceCop}|${areaM2}`)
    .digest("hex")

  return {
    externalId: `mc:${propertyId}`,
    url: canonical,
    title,
    priceCop,
    areaM2,
    areaBuiltM2: areaM2,
    areaTerrainM2: null,
    estrato: parseIntSafe(estratoMatch?.[1] ?? null),
    neighborhood,
    city,
    department,
    propertyType: "Apartamento",
    operationType: "Venta",
    bedrooms: null,
    bathrooms: null,
    latitude: null,
    longitude: null,
    imageUrl: `https://multimedia.metrocuadrado.com/${propertyId}/${propertyId}_2_h.jpg`,
    description: null,
    address: null,
    technicalSheet: null,
    locationPath: [city, neighborhood].filter(Boolean) as string[],
    sourceFingerprint: fingerprint,
  }
}

export const parseMetrocuadradoListingFromHtml = (
  inputUrl: string,
  html: string,
): ParsedListing => {
  const canonical = validateMetrocuadradoUrl(inputUrl)
  const propertyId = extractMetrocuadradoIdFromUrl(canonical)
  if (!propertyId) throw new Error("url_path_invalid")

  const data = extractPropertyObject(html, propertyId)
  if (!data) {
    return parseFromSsrFallback(html, propertyId, canonical)
  }

  const salePrice = parseIntSafe(data.salePrice)
  const rentPrice = parseIntSafe(data.rentPrice)
  const isSale = data.isSale === true || data.businessType === "venta" || salePrice != null
  const priceCop = isSale ? salePrice : rentPrice
  if (priceCop == null || priceCop <= 0) throw new Error("price_missing")

  const areaM2 =
    parseNumber(data.area) ??
    parseNumber(data.areac) ??
    parseNumber(data.areaPrivada)
  if (areaM2 == null || areaM2 <= 0) throw new Error("area_missing")

  const areaBuiltM2 = parseNumber(data.areac) ?? areaM2
  const areaTerrainM2 = null

  const cityName = namedString(data.city)
  if (!cityName?.trim()) throw new Error("city_missing")
  const city = titleCase(cityName)
  const neighborhoodRaw =
    namedString(data.neighborhood) ??
    namedString(data.commonNeighborhood)
  const neighborhood = neighborhoodRaw
    ? titleCase(neighborhoodRaw.replace(/\s+/g, " "))
    : null
  const department = CITY_DEPARTMENT[city.toLowerCase()] ?? "Colombia"

  const propertyType = titleCase(namedString(data.propertyType) ?? "Apartamento")
  const operationType = titleCase(
    namedString(data.businessType) ?? (isSale ? "Venta" : "Arriendo"),
  )

  const coords =
    data.coordinates != null && typeof data.coordinates === "object"
      ? (data.coordinates as Json)
      : null
  const latitude = parseNumber(coords?.lat)
  const longitude = parseNumber(coords?.lon)

  const title = (
    (typeof data.title === "string" && data.title.trim()) ||
    (typeof data.shortTitle === "string" && data.shortTitle.trim()) ||
    `${propertyType} en ${operationType}, ${neighborhood ?? city}`
  ).slice(0, 300)

  const description =
    typeof data.comment === "string" ? data.comment.slice(0, 8000) : null

  const imageUrl =
    typeof data.imageLink === "string" && data.imageLink.trim()
      ? data.imageLink.trim()
      : `https://multimedia.metrocuadrado.com/${propertyId}/${propertyId}_2_h.jpg`

  const fingerprint = createHash("sha1")
    .update(`${canonical}|${title}|${priceCop}|${areaM2}`)
    .digest("hex")

  const zone = namedString(data.zone)
  const locationPath = [city, zone, neighborhood].filter(Boolean) as string[]

  return {
    externalId: `mc:${propertyId}`,
    url: canonical,
    title,
    priceCop,
    areaM2,
    areaBuiltM2,
    areaTerrainM2,
    estrato: parseIntSafe(data.stratum),
    neighborhood,
    city,
    department,
    propertyType,
    operationType,
    bedrooms: parseIntSafe(data.rooms),
    bathrooms: parseIntSafe(data.bathrooms),
    latitude,
    longitude,
    imageUrl,
    description,
    address: null,
    technicalSheet: null,
    locationPath,
    sourceFingerprint: fingerprint,
  }
}
