/** Strip common Colombian listing prefixes from conjunto names. */
const CONJUNTO_PREFIX_RE =
  /^\s*(?:conjunto(?:\s+cerrado)?|condominio|cond\.?|urbanizaci[oó]n|unidad\s+residencial)\s*[:\s,\-]*/i

/** Trailing address fragments often appended to the same complex name. */
const TRAILING_ADDRESS_RE =
  /\s+(?:(?:av\.?|avenida|cra\.?|carrera|cll\.?|calle|kr\.?|kra\.?|dg\.?|diagonal|transversal|tv\.?)\.?\s+[-\w#.]+(?:\s+[-\w#.]+)*)\s*$/i

const TRAILING_CARDINAL_RE = /\s+(?:sur|norte|este|oeste)\s*$/i

/** Generic words stripped when building a conjunto “signature” for fuzzy matching. */
const CONJUNTO_GENERIC_TOKENS = new Set([
  "al",
  "club",
  "cerrado",
  "cond",
  "condominio",
  "conjunto",
  "de",
  "del",
  "edificio",
  "el",
  "en",
  "etapa",
  "fase",
  "la",
  "las",
  "los",
  "portal",
  "residencial",
  "torre",
  "unidad",
  "urbanizacion",
  "y",
])

function foldConjuntoText(input: string): string {
  const s = stripConjuntoAddressSuffix(stripConjuntoPrefixes(input))
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Distinctive tokens (e.g. nogal) shared across spelling variants. */
export function conjuntoMatchTokens(input: string): string[] {
  const tokens = foldConjuntoText(input).split(" ").filter(Boolean)
  const sig = tokens.filter(
    (t) => !CONJUNTO_GENERIC_TOKENS.has(t) && t.length >= 3,
  )
  if (sig.length > 0) return sig
  return tokens.filter((t) => !CONJUNTO_GENERIC_TOKENS.has(t) && t.length >= 2)
}

/** Stable bucket key: same complex despite club/residencial/conjunto prefix differences. */
export function conjuntoCoreKey(input: string): string {
  const tokens = conjuntoMatchTokens(input)
  if (tokens.length > 0) return tokens.slice().sort().join("|")
  const full = normalizeConjuntoKey(input)
  return full || ""
}

function signaturesMatch(a: string, b: string): boolean {
  const ta = conjuntoMatchTokens(a)
  const tb = conjuntoMatchTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const longSet = new Set(long)
  return short.every((t) => longSet.has(t))
}

export function stripConjuntoPrefixes(raw: string): string {
  let s = raw.trim()
  let prev = ""
  while (s !== prev) {
    prev = s
    s = s.replace(CONJUNTO_PREFIX_RE, "").trim()
  }
  return s
}

export function stripConjuntoAddressSuffix(raw: string): string {
  let s = raw.trim()
  let prev = ""
  while (s !== prev) {
    prev = s
    s = s.replace(TRAILING_ADDRESS_RE, "").trim()
    s = s.replace(TRAILING_CARDINAL_RE, "").trim()
  }
  return s
}

/** Fold accents/punctuation into a compact match key (like barrio keys). */
export function normalizeConjuntoKey(input: string): string {
  let s = stripConjuntoAddressSuffix(stripConjuntoPrefixes(input))
  s = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  s = s.replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim()
  return s.replace(/\s+/g, "")
}

export function conjuntoKeysMatch(a: string, b: string): boolean {
  const ka = normalizeConjuntoKey(a)
  const kb = normalizeConjuntoKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true

  const short = ka.length <= kb.length ? ka : kb
  const long = ka.length <= kb.length ? kb : ka
  if (short.length >= 10 && long.startsWith(short)) return true
  if (short.length >= 8 && long.startsWith(short) && short.length / long.length >= 0.65) {
    return true
  }

  if (signaturesMatch(a, b)) return true

  const ca = conjuntoMatchTokens(a).join("")
  const cb = conjuntoMatchTokens(b).join("")
  if (ca.length >= 4 && cb.includes(ca)) return true
  if (cb.length >= 4 && ca.includes(cb)) return true

  return false
}

function scoreConjuntoDisplay(name: string): number {
  let score = name.length
  if (/(\bav\.?\s|\bavenida\s|\bcra\.?\s|\bcarrera\s|\bcll\.?\s)/i.test(name)) score += 80
  if (/^\s*conjunto\s+cerrado\s/i.test(name)) score += 15
  if (/^\s*conjunto\s/i.test(name)) score += 8
  return score
}

/** Pick the cleanest label to show humans for a cluster of variants. */
export function pickConjuntoCanonical(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  return [...names].sort(
    (a, b) => scoreConjuntoDisplay(a) - scoreConjuntoDisplay(b) || a.localeCompare(b),
  )[0]
}

export type ConjuntoGrouped = {
  key: string
  canonical: string
  variants: string[]
  count: number
}

/** Cluster raw DB conjunto strings into variant groups (O(n) by core signature). */
export function groupConjuntoNames(
  items: { name: string; count?: number }[],
): ConjuntoGrouped[] {
  const buckets = new Map<string, { names: string[]; count: number }>()

  for (const { name, count = 0 } of items) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = conjuntoCoreKey(trimmed)
    if (!key) continue

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { names: [], count: 0 }
      buckets.set(key, bucket)
    }
    if (!bucket.names.includes(trimmed)) bucket.names.push(trimmed)
    bucket.count += count
  }

  return Array.from(buckets.entries())
    .map(([key, { names, count }]) => ({
      key,
      canonical: pickConjuntoCanonical(names),
      variants: names,
      count,
    }))
    .sort(
      (a, b) => b.count - a.count || a.canonical.localeCompare(b.canonical),
    )
}

export function filterConjuntoVariants(
  allNames: string[],
  selected: string,
): string[] {
  const needle = selected.trim()
  if (!needle) return []
  const variants = allNames.filter((name) => conjuntoKeysMatch(name, needle))
  return variants.length > 0 ? variants : [needle]
}
