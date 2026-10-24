import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  isLocaleSegmentRoute,
  stripLocalePrefix,
  toInternalPath,
  toPublicPath,
} from "@/lib/locale";

/** Home OG image is generated at app/[locale]/opengraph-image. */
const HOME_OG_IMAGE_PATH = "/es/opengraph-image";

function documentLang(pathname: string): "es" {
  void pathname;
  return "es";
}

function withDocumentLang(res: NextResponse, pathname: string): NextResponse {
  res.headers.set("x-document-lang", documentLang(pathname));
  return res;
}

/** Spanish public path for /en/*, /es/* and English internal slugs; null when already public. */
function legacyRedirectPath(pathname: string): string | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return stripLocalePrefix(pathname);
  }
  if (pathname === "/es" || pathname.startsWith("/es/")) {
    return toPublicPath(pathname.slice(3) || "/");
  }
  const publicPath = toPublicPath(pathname);
  return publicPath === pathname ? null : publicPath;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (pathname === HOME_OG_IMAGE_PATH) {
    return withDocumentLang(NextResponse.next(), pathname);
  }

  const redirectPath = legacyRedirectPath(pathname);
  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return withDocumentLang(NextResponse.redirect(url, 301), pathname);
  }

  const internal = pathname === "/" ? "/" : toInternalPath(pathname);
  if (internal) {
    const url = request.nextUrl.clone();
    url.pathname = isLocaleSegmentRoute(internal)
      ? `/es${internal === "/" ? "" : internal}`
      : internal;
    const res = NextResponse.rewrite(url);
    res.headers.set("x-locale", "es");
    return withDocumentLang(res, pathname);
  }

  if (pathname.startsWith("/anuncio/")) {
    const res = NextResponse.next();
    res.headers.set("x-locale", "es");
    return withDocumentLang(res, pathname);
  }

  return withDocumentLang(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/).*)"],
};
