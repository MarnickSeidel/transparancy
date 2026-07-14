type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  ok: boolean
  retryAfterSec?: number
}

/** Simple in-memory sliding-window rate limiter (per server instance). */
export const checkRateLimit = (
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult => {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }

  bucket.count += 1
  return { ok: true }
}

export const clientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

export const rateLimitResponse = (retryAfterSec: number) =>
  new Response(
    JSON.stringify({ error: "rate_limit_exceeded", retryAfterSec }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  )

/** Returns a 429 Response when limited, otherwise null. */
export const enforceRateLimit = (
  req: Request,
  route: string,
  limit: number,
  windowMs: number,
): Response | null => {
  const result = checkRateLimit(`${route}:${clientIp(req)}`, limit, windowMs)
  if (result.ok) return null
  return rateLimitResponse(result.retryAfterSec ?? 60)
}
