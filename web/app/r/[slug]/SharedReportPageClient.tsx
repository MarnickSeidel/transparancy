"use client"

import { useEffect, useState } from "react"

import PageFooter from "@/app/components/PageFooter"
import SharedReportView from "@/app/components/SharedReportView"
import Card from "@/app/components/ui/Card"
import Skeleton from "@/app/components/ui/Skeleton"
import SiteHeader from "@/app/components/SiteHeader"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { isSharedAnalyzePayload, type SharedAnalyzePayload } from "@/lib/shareReport"
import { useUiLang } from "@/lib/useUiLang"

type Props = {
  slug: string
}

export default function SharedReportPageClient({ slug }: Props) {
  const { lang, toggleLang } = useUiLang("es")
  const txt = uiText[lang]

  const [reportLang, setReportLang] = useState<Lang>("es")
  const [payload, setPayload] = useState<SharedAnalyzePayload | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<"not_found" | "expired" | "server" | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/reports/${encodeURIComponent(slug)}`)
        const j = (await res.json()) as {
          payload?: unknown
          lang?: string
          createdAt?: string
          error?: string
        }
        if (cancelled) return
        if (res.status === 404) {
          setError("not_found")
          return
        }
        if (res.status === 410) {
          setError("expired")
          return
        }
        if (!res.ok || !isSharedAnalyzePayload(j.payload)) {
          setError("server")
          return
        }
        setPayload(j.payload)
        setReportLang(j.lang === "en" ? "en" : "es")
        setCreatedAt(j.createdAt ?? null)
      } catch {
        if (!cancelled) setError("server")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const displayLang = payload ? reportLang : lang
  const displayTxt = uiText[displayLang]

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={displayTxt.shareReportPageTitle}
        subtitle={displayTxt.shareReportPageSubtitle}
        active="analyzeUrl"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        {loading ? (
          <Card className="space-y-4 p-6">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full" />
          </Card>
        ) : null}

        {!loading && error === "not_found" ? (
          <Card>
            <p className="text-sm text-muted">{txt.shareReportNotFound}</p>
          </Card>
        ) : null}

        {!loading && error === "expired" ? (
          <Card>
            <p className="text-sm text-muted">{txt.shareReportExpired}</p>
          </Card>
        ) : null}

        {!loading && error === "server" ? (
          <Card>
            <p className="text-sm text-muted">{txt.shareReportError}</p>
          </Card>
        ) : null}

        {!loading && payload ? (
          <SharedReportView
            payload={payload}
            lang={displayLang}
            createdAt={createdAt}
            showShareActions={false}
          />
        ) : null}
      </main>

      <PageFooter />
    </div>
  )
}
