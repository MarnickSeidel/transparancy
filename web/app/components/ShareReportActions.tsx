"use client"

import { useState } from "react"

import Button from "@/app/components/ui/Button"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import {
  buildShareMessage,
  type SharedAnalyzePayload,
  whatsAppShareUrl,
} from "@/lib/shareReport"

type Props = {
  payload: SharedAnalyzePayload
  lang: Lang
}

export default function ShareReportActions({ payload, lang }: Props) {
  const txt = uiText[lang]
  const [sharePath, setSharePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const absoluteUrl = (path: string) => {
    if (typeof window === "undefined") return path
    return `${window.location.origin}${path}`
  }

  const ensureShareLink = async (): Promise<string | null> => {
    if (sharePath) return sharePath
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/reports/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, lang }),
      })
      const j = (await res.json()) as { path?: string; error?: string }
      if (!res.ok || !j.path) {
        setError(txt.shareReportError)
        return null
      }
      setSharePath(j.path)
      return j.path
    } catch {
      setError(txt.shareReportError)
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    const path = await ensureShareLink()
    if (!path) return
    const url = absoluteUrl(path)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(txt.shareReportError)
    }
  }

  const handleWhatsApp = async () => {
    const path = await ensureShareLink()
    if (!path) return
    const url = absoluteUrl(path)
    const text = buildShareMessage(payload, url, lang)
    window.open(whatsAppShareUrl(text), "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        type="button"
        variant="secondary"
        disabled={loading}
        onClick={() => void handleCopy()}
        aria-label={txt.shareReportCopy}
      >
        {copied ? txt.shareReportCopied : loading ? txt.shareReportCreating : txt.shareReportCopy}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={loading}
        onClick={() => void handleWhatsApp()}
        aria-label={txt.shareReportWhatsApp}
      >
        {txt.shareReportWhatsApp}
      </Button>
      {sharePath ? (
        <a
          href={sharePath}
          className="text-sm font-semibold text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {txt.shareReportOpen}
        </a>
      ) : null}
      {error ? <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p> : null}
    </div>
  )
}
