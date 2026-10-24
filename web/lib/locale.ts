export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALES: Locale[] = ["es"];

export const OPPORTUNITIES_CANONICAL = "/oportunidades" as const;
export const ESTIMATE_CANONICAL = "/cuanto-vale-mi-casa" as const;
export const ANALYZE_CANONICAL = "/analizar-anuncio" as const;
export const LISTING_ROUTE_PREFIX = "/anuncio" as const;

/** Public Spanish URL prefix ↔ internal app route. Prefixes must not overlap. */
export const PUBLIC_ROUTES: ReadonlyArray<{ public: string; internal: string }> = [
  { public: OPPORTUNITIES_CANONICAL, internal: "/opportunities" },
  { public: ESTIMATE_CANONICAL, internal: "/estimate" },
  { public: ANALYZE_CANONICAL, internal: "/analyze-url" },
  { public: "/barrios", internal: "/zones" },
  { public: "/metodologia", internal: "/methodology" },
  { public: "/privacidad", internal: "/privacy" },
  { public: "/acerca-de", internal: "/about" },
  { public: "/explorar", internal: "/explore" },
  { public: "/mapa-de-precios", internal: "/heatmap" },
  { public: "/bajadas-de-precio", internal: "/price-drops" },
  { public: "/mercado-en-cifras", internal: "/dashboard" },
  { public: "/correo/confirmado", internal: "/email/confirmed" },
  { public: "/correo/preferencias", internal: "/email/preferences" },
  { public: "/correo/cancelado", internal: "/email/unsubscribed" },
];

/** Internal routes served from app/[locale] (rewritten to /es/*). */
const LOCALE_SEGMENT_ROUTES = ["/zones", "/methodology", "/privacy", "/about"];

function swapPrefix(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return null;
}

/** Internal route → public Spanish path. Unmapped paths pass through. */
export function toPublicPath(pathname: string): string {
  for (const r of PUBLIC_ROUTES) {
    const swapped = swapPrefix(pathname, r.internal, r.public);
    if (swapped) return swapped;
  }
  return pathname;
}

/** Public Spanish path → internal route, or null when the path has no Spanish slug. */
export function toInternalPath(pathname: string): string | null {
  for (const r of PUBLIC_ROUTES) {
    const swapped = swapPrefix(pathname, r.public, r.internal);
    if (swapped) return swapped;
  }
  return null;
}

export function isLocaleSegmentRoute(internalPath: string): boolean {
  if (internalPath === "/") return true;
  return LOCALE_SEGMENT_ROUTES.some(
    (p) => internalPath === p || internalPath.startsWith(`${p}/`),
  );
}

export function listingPath(locale: Locale, id: string): string {
  void locale;
  return `${LISTING_ROUTE_PREFIX}/${id}`;
}

export function opportunitiesPath(locale: Locale, search = ""): string {
  void locale;
  const base = "/oportunidades";
  if (!search) return base;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${qs}`;
}

export function analyzePath(locale: Locale, search = ""): string {
  void locale;
  const base = ANALYZE_CANONICAL;
  if (!search) return base;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${qs}`;
}

export function estimatePath(locale: Locale, search = ""): string {
  void locale;
  const base = ESTIMATE_CANONICAL;
  if (!search) return base;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${qs}`;
}

export function parseLocaleFromPath(pathname: string): Locale {
  void pathname;
  return DEFAULT_LOCALE;
}

/** Public Spanish path for any internal, legacy /en/* or /listing/* path (query dropped). */
export function stripLocalePrefix(pathname: string): string {
  let path = pathname.split("?")[0];
  if (path === "/en") return "/";
  if (path.startsWith("/en/")) path = path.slice(3) || "/";
  if (path.startsWith("/listing/")) {
    return `${LISTING_ROUTE_PREFIX}/${path.slice("/listing/".length)}`;
  }
  return toPublicPath(path);
}

/** Public path (query string preserved). The site is Spanish-only; the locale argument is ignored. */
export function localePath(locale: Locale, path: string): string {
  void locale;
  const raw = path.startsWith("/") ? path : `/${path}`;
  const q = raw.indexOf("?");
  if (q === -1) return stripLocalePrefix(raw);
  return `${stripLocalePrefix(raw.slice(0, q))}${raw.slice(q)}`;
}

/** Tool route with optional query string. */
export function localeToolPath(locale: Locale, path: string, search = ""): string {
  const base = localePath(locale, path.split("?")[0]);
  if (!search) return base;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${qs}`;
}

/** Resolve nav/footer hrefs that may use translated slugs. */
export function resolveNavHref(href: string, locale: Locale): string {
  return localePath(locale, href);
}

export function switchLocalePath(currentPathname: string, target: Locale): string {
  const [path, query] = currentPathname.split("?");
  const result = localePath(target, path);
  return query ? `${result}?${query}` : result;
}

export function htmlLang(locale: Locale): string {
  void locale;
  return "es";
}

export function ogLocale(locale: Locale): string {
  void locale;
  return "es_CO";
}
