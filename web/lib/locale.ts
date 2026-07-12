export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALES: Locale[] = ["es", "en"];

const INDEXABLE_PREFIXES = ["/zones", "/methodology", "/privacy", "/about"];

export function isIndexablePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return INDEXABLE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function parseLocaleFromPath(pathname: string): Locale {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  return "es";
}

/** Strip /en prefix to get the canonical path segment (e.g. /en/zones → /zones). */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname;
}

/** Build a locale-aware path. Spanish uses unprefixed URLs. */
export function localePath(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === "es") return p;
  return p === "/" ? "/en" : `/en${p}`;
}

export function switchLocalePath(currentPathname: string, target: Locale): string {
  return localePath(target, stripLocalePrefix(currentPathname));
}

export function htmlLang(locale: Locale): string {
  return locale === "es" ? "es" : "en";
}

export function ogLocale(locale: Locale): string {
  return locale === "es" ? "es_CO" : "en_US";
}
