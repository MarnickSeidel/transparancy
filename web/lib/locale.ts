export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALES: Locale[] = ["es", "en"];

export const OPPORTUNITIES_CANONICAL = "/oportunidades" as const;
export const LISTING_ROUTE_PREFIX = "/anuncio" as const;

const INDEXABLE_PREFIXES = ["/zones", "/methodology", "/privacy", "/about"];

export function isListingDetailPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return path.startsWith(`${LISTING_ROUTE_PREFIX}/`) || path.startsWith("/en/listing/");
}

export function listingPath(locale: Locale, id: string): string {
  return locale === "es" ? `${LISTING_ROUTE_PREFIX}/${id}` : `/en/listing/${id}`;
}

export function parseListingIdFromPath(pathname: string): string | null {
  const path = pathname.split("?")[0];
  if (path.startsWith(`${LISTING_ROUTE_PREFIX}/`)) {
    const id = path.slice(`${LISTING_ROUTE_PREFIX}/`.length);
    return id || null;
  }
  if (path.startsWith("/en/listing/")) {
    const id = path.slice("/en/listing/".length);
    return id || null;
  }
  return null;
}

export function isOpportunitiesPath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return (
    path === "/oportunidades" ||
    path === "/opportunities" ||
    path === "/en/opportunities" ||
    path.startsWith("/oportunidades/") ||
    path.startsWith("/opportunities/") ||
    path.startsWith("/en/opportunities/")
  );
}

export function opportunitiesPath(locale: Locale, search = ""): string {
  const base = locale === "es" ? "/oportunidades" : "/en/opportunities";
  if (!search) return base;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${qs}`;
}

export function isIndexablePath(pathname: string): boolean {
  if (isOpportunitiesPath(pathname)) return true;
  if (isListingDetailPath(pathname)) return true;
  const path = stripLocalePrefix(pathname);
  if (path === "/") return true;
  return INDEXABLE_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

export function parseLocaleFromPath(pathname: string): Locale {
  const path = pathname.split("?")[0];
  if (path === "/en/opportunities" || path.startsWith("/en/opportunities/")) {
    return "en";
  }
  if (path === "/oportunidades" || path.startsWith("/oportunidades/")) {
    return "es";
  }
  if (path === "/opportunities" || path.startsWith("/opportunities/")) {
    return "es";
  }
  if (path.startsWith("/en/listing/")) return "en";
  if (path.startsWith(`${LISTING_ROUTE_PREFIX}/`)) return "es";
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  return "es";
}

/** Strip /en prefix to get the canonical path segment (e.g. /en/zones → /zones). */
export function stripLocalePrefix(pathname: string): string {
  const pathOnly = pathname.split("?")[0];
  if (pathOnly === "/en") return "/";
  if (pathOnly.startsWith("/en/")) {
    const stripped = pathOnly.slice(3) || "/";
    if (stripped === "/opportunities") return OPPORTUNITIES_CANONICAL;
    if (stripped.startsWith("/listing/")) {
      return `${LISTING_ROUTE_PREFIX}/${stripped.slice("/listing/".length)}`;
    }
    return stripped;
  }
  if (pathOnly === "/opportunities") return OPPORTUNITIES_CANONICAL;
  return pathOnly;
}

/** Build a locale-aware path. Spanish uses unprefixed URLs. */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === OPPORTUNITIES_CANONICAL || p === "/opportunities") {
    return opportunitiesPath(locale);
  }
  if (p.startsWith(`${LISTING_ROUTE_PREFIX}/`)) {
    const id = p.slice(`${LISTING_ROUTE_PREFIX}/`.length);
    return listingPath(locale, id);
  }
  if (locale === "es") return p;
  return p === "/" ? "/en" : `/en${p}`;
}

/** Resolve nav/footer hrefs that may use translated slugs. */
export function resolveNavHref(href: string, locale: Locale): string {
  if (href === OPPORTUNITIES_CANONICAL || href === "/opportunities") {
    return opportunitiesPath(locale);
  }
  return localePath(locale, href);
}

export function switchLocalePath(currentPathname: string, target: Locale): string {
  const [path, query] = currentPathname.split("?");
  const result = localePath(target, stripLocalePrefix(path));
  return query ? `${result}?${query}` : result;
}

export function htmlLang(locale: Locale): string {
  return locale === "es" ? "es" : "en";
}

export function ogLocale(locale: Locale): string {
  return locale === "es" ? "es_CO" : "en_US";
}
