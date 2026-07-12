import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isIndexablePath } from "@/lib/locale";

const TOOL_PREFIXES = [
  "/dashboard",
  "/explore",
  "/opportunities",
  "/heatmap",
  "/estimate",
  "/analyze-url",
];

function isToolPath(pathname: string): boolean {
  return TOOL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
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
