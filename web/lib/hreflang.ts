import { absoluteUrl } from "@/lib/siteUrl";
import { localePath, type Locale } from "@/lib/locale";

/** Build alternates.languages for metadata API (hreflang). */
export function hreflangAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const base = path.startsWith("/") ? path : `/${path}`;
  const esUrl = absoluteUrl(localePath("es", base));
  return {
    canonical: esUrl,
    languages: {
      es: esUrl,
      "x-default": esUrl,
    },
  };
}

export function canonicalForLocale(path: string, locale: Locale): string {
  const base = path.startsWith("/") ? path : `/${path}`;
  return absoluteUrl(localePath(locale, base));
}
