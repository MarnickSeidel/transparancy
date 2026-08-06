import { NextResponse } from "next/server"

/**
 * Reject browser cross-site mutating requests (CSRF-style).
 * Allows non-browser clients (no Sec-Fetch-Site / Origin) and same-origin callers.
 */
export function enforceSameOrigin(req: Request): Response | null {
  const site = req.headers.get("sec-fetch-site")
  if (site === "cross-site") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const origin = req.headers.get("origin")
  if (!origin) return null

  try {
    const requestOrigin = new URL(req.url).origin
    if (origin !== requestOrigin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return null
}
