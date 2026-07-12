type CacheEntry<T> = { data: T; expiresAt: number }

const store = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 120_000

export async function fetchJsonCached<T>(
  url: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()
  const hit = store.get(url)
  if (hit && hit.expiresAt > now) {
    return hit.data as T
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed: ${url}`)
  const data = (await res.json()) as T
  store.set(url, { data, expiresAt: now + ttlMs })
  return data
}

export const invalidateFetchCache = (urlPrefix?: string) => {
  if (!urlPrefix) {
    store.clear()
    return
  }
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(urlPrefix)) store.delete(key)
  }
}
