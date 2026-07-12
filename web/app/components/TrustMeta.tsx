type Props = {
  sampleSize?: number | null
  minSample?: number
  confidence?: "high" | "medium" | "low" | null
  updatedAt?: string | null
  source?: string
  labels: {
    sample: string
    confidence: string
    updated: string
    source?: string
  }
  className?: string
}

export default function TrustMeta({
  sampleSize,
  minSample,
  confidence,
  updatedAt,
  source,
  labels,
  className = "",
}: Props) {
  const items: string[] = []

  if (sampleSize != null && Number.isFinite(sampleSize)) {
    const suffix = minSample != null ? ` (min ${minSample})` : ""
    items.push(`${labels.sample}: n=${sampleSize}${suffix}`)
  }

  if (confidence) {
    items.push(`${labels.confidence}: ${confidence}`)
  }

  if (updatedAt) {
    items.push(`${labels.updated}: ${updatedAt}`)
  }

  if (source && labels.source) {
    items.push(`${labels.source}: ${source}`)
  }

  if (items.length === 0) return null

  return (
    <p className={`text-meta flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </p>
  )
}
