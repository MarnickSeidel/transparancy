import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isIndexablePath, isOpportunitiesPath } from "@/lib/locale";

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
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/es/oportunidades" || pathname.startsWith("/es/oportunidades/")) {
    const stripped =
      pathname === "/es/oportunidades"
        ? "/oportunidades"
        : pathname.replace(/^\/es\/oportunidades/, "/oportunidades");
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return NextResponse.redirect(url);
  }

  if (pathname === "/oportunidades" || pathname.startsWith("/oportunidades/")) {
    return rewriteOpportunities(request, pathname, "es");
  }

  if (pathname === "/en/opportunities" || pathname.startsWith("/en/opportunities/")) {
    return rewriteOpportunities(request, pathname, "en");
  }

  if (pathname.startsWith("/en/") && isToolPath(pathname.slice(3))) {
    return NextResponse.redirect(new URL(pathname.slice(3), request.url));
  }
  if (pathname === "/en" && false) {
    /* homepage only */
  }

  if (pathname === "/es" || pathname.startsWith("/es/")) {
    const stripped =
      pathname === "/es" ? "/" : pathname.replace(/^\/es/, "") || "/";
    return NextResponse.redirect(new URL(stripped, request.url));
  }

  if (
    !pathname.startsWith("/en") &&
    isIndexablePath(pathname) &&
    !isOpportunitiesPath(pathname) &&
    !pathname.startsWith("/_next")
  ) {
    const rewritePath = pathname === "/" ? "/es" : `/es${pathname}`;
    return NextResponse.rewrite(new URL(rewritePath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding/).*)"],
};
