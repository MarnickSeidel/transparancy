type Props = {
  sampleSize?: number | null
  minSample?: number
  confidence?: "high" | "medium" | "low" | null
  confidenceText?: string | null
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
  confidenceText,
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

  const confidenceDisplay = confidenceText ?? confidence
  if (confidenceDisplay) {
    items.push(`${labels.confidence}: ${confidenceDisplay}`)
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
