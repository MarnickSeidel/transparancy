import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isIndexablePath, isListingDetailPath, isOpportunitiesPath } from "@/lib/locale";

const TOOL_PREFIXES = [
  "/dashboard",
  "/explore",
  "/heatmap",
  "/estimate",
  "/analyze-url",
  "/price-drops",
];

function isToolPath(pathname: string): boolean {
  return TOOL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function rewriteOpportunities(
  request: NextRequest,
  pathname: string,
  locale: "es" | "en",
): NextResponse {
  const rewritePath = pathname
    .replace("/en/opportunities", "/opportunities")
    .replace("/oportunidades", "/opportunities");
  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-locale", locale);
  return res;
}

function documentLang(pathname: string): "es" | "en" {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "es";
}

function withDocumentLang(res: NextResponse, pathname: string): NextResponse {
  res.headers.set("x-document-lang", documentLang(pathname));
  return res;
}

function rewriteListingDetail(
  request: NextRequest,
  pathname: string,
  locale: "es" | "en",
): NextResponse {
  const rewritePath = pathname.replace("/en/listing", "/anuncio");
  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-locale", locale);
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (pathname === "/opportunities" || pathname.startsWith("/opportunities/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/opportunities", "/oportunidades");
    return withDocumentLang(NextResponse.redirect(url, 301), pathname);
  }

  if (pathname === "/es/oportunidades" || pathname.startsWith("/es/oportunidades/")) {
    const stripped =
      pathname === "/es/oportunidades"
        ? "/oportunidades"
        : pathname.replace(/^\/es\/oportunidades/, "/oportunidades");
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return withDocumentLang(NextResponse.redirect(url), pathname);
  }

  if (pathname === "/oportunidades" || pathname.startsWith("/oportunidades/")) {
    return withDocumentLang(
      rewriteOpportunities(request, pathname, "es"),
      pathname,
    );
  }

  if (pathname === "/en/opportunities" || pathname.startsWith("/en/opportunities/")) {
    return withDocumentLang(
      rewriteOpportunities(request, pathname, "en"),
      pathname,
    );
  }

  if (pathname === "/es/anuncio" || pathname.startsWith("/es/anuncio/")) {
    const stripped =
      pathname === "/es/anuncio"
        ? "/anuncio"
        : pathname.replace(/^\/es\/anuncio/, "/anuncio");
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return withDocumentLang(NextResponse.redirect(url), pathname);
  }

  if (pathname.startsWith("/en/listing/")) {
    return withDocumentLang(
      rewriteListingDetail(request, pathname, "en"),
      pathname,
    );
  }

  if (pathname.startsWith("/anuncio/")) {
    const res = NextResponse.next();
    res.headers.set("x-locale", "es");
    return withDocumentLang(res, pathname);
  }

  if (pathname.startsWith("/en/") && isToolPath(pathname.slice(3))) {
    return withDocumentLang(
      NextResponse.redirect(new URL(pathname.slice(3), request.url)),
      pathname,
    );
  }

  if (pathname === "/es" || pathname.startsWith("/es/")) {
    const stripped =
      pathname === "/es" ? "/" : pathname.replace(/^\/es/, "") || "/";
    return withDocumentLang(
      NextResponse.redirect(new URL(stripped, request.url)),
      pathname,
    );
  }

  if (
    !pathname.startsWith("/en") &&
    isIndexablePath(pathname) &&
    !isOpportunitiesPath(pathname) &&
    !isListingDetailPath(pathname) &&
    !pathname.startsWith("/_next")
  ) {
    const rewritePath = pathname === "/" ? "/es" : `/es${pathname}`;
    return withDocumentLang(
      NextResponse.rewrite(new URL(rewritePath, request.url)),
      pathname,
    );
  }

  return withDocumentLang(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/).*)"],
};
