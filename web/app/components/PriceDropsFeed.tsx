"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import DomBadge from "@/app/components/DomBadge"
import EmailSignupForm from "@/app/components/EmailSignupForm"
import PageFooter from "@/app/components/PageFooter"
import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import Skeleton from "@/app/components/ui/Skeleton"
import SiteHeader from "@/app/components/SiteHeader"
import { fetchJsonCached } from "@/lib/clientFetchCache"
import { formatDomDays } from "@/lib/formatDom"
import { uiText } from "@/lib/i18n"
import type { PriceDropRow } from "@/lib/getPriceDrops"
import { propertyTypeLabel } from "@/lib/propertyTypes"
import { useUiLang } from "@/lib/useUiLang"

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—"
  return `$ ${Math.round(v).toLocaleString(locale)}`
}

function fmtTemplate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

function initialCityParam(): string {
  if (typeof window === "undefined") return "all"
  const v = new URLSearchParams(window.location.search).get("city")?.trim()
  return v && v.length > 0 ? v : "all"
}

export default function PriceDropsFeed() {
  const { lang, toggleLang } = useUiLang("es")
  const txt = uiText[lang]
  const locale = lang === "es" ? "es-CO" : "en-US"

  const [cities, setCities] = useState<string[]>([])
  const [city, setCity] = useState(() => initialCityParam())
  const [drops, setDrops] = useState<PriceDropRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchJsonCached<{ cities: string[] }>("/api/filters")
      .then((j) => setCities(j.cities ?? []))
      .catch(() => setCities([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (city !== "all") p.set("city", city)
      p.set("limit", "40")
      const j = await fetchJsonCached<{ drops: PriceDropRow[] }>(`/api/price-drops?${p.toString()}`)
      setDrops(j.drops ?? [])
    } catch {
      setError(txt.couldNotLoad)
    } finally {
      setLoading(false)
    }
  }, [city, txt.couldNotLoad])

  useEffect(() => {
    void load()
  }, [load])

  const analyzeHref = useMemo(() => "/analyze-url", [])

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.priceDropsTitle}
        subtitle={txt.priceDropsPurpose}
        active="priceDrops"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        <Card className="mb-6 border-slate-200/90 shadow-card">
          <p className="text-sm text-muted">{txt.priceDropsHint}</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-medium text-muted">
              {txt.city}
              <select
                className={`${inputClassName} mt-1`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="all">{txt.allCities}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              {txt.refresh}
            </Button>
          </div>
        </Card>

        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : drops.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{txt.priceDropsEmpty}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {drops.map((row) => {
              const domLabel = formatDomDays(row.domDays, lang)
              return (
                <Card key={row.id} className="border-slate-200/90 shadow-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60">
                          −{row.dropPct.toFixed(1)}%
                        </span>
                        {domLabel ? (
                          <DomBadge days={row.domDays} lang={lang} label={domLabel} />
                        ) : null}
                      </div>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-base font-semibold text-accent hover:underline"
                      >
                        {row.title}
                      </a>
                      <p className="mt-1 text-sm text-muted">
                        {row.city}
                        {row.neighborhood ? ` · ${row.neighborhood}` : ""}
                        {row.propertyType
                          ? ` · ${propertyTypeLabel(row.propertyType, lang)}`
                          : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {txt.priceDropsRecorded}:{" "}
                        {new Date(row.recordedAt).toLocaleDateString(locale, {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="text-meta line-through">{fmtCop(Number(row.previousPriceCop), locale)}</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {fmtCop(Number(row.priceCop), locale)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                        {txt.priceDropsSaved}: {fmtCop(row.dropCop, locale)}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <EmailSignupForm
          lang={lang}
          source="price_drops"
          title={txt.subscribeTitle}
          hint={city !== "all" ? fmtTemplate(txt.estimateSubscribeHint, { city }) : txt.subscribeHint}
          defaultCity={city !== "all" ? city : "Pereira"}
          defaultLists={["price_drops_city", "deals_city"]}
          visibleLists={["price_drops_city", "deals_city", "market_monthly_city"]}
          collapsedByDefault
          className="mt-8"
        />

        <Card className="mt-8 border-teal-200/80 bg-teal-50/40 dark:border-teal-900/60 dark:bg-teal-950/20">
          <p className="text-sm text-foreground">{txt.priceDropsAnalyzeCta}</p>
          <Button href={analyzeHref} className="mt-3">
            {txt.analyzeUrlNav}
          </Button>
        </Card>
      </main>

      <PageFooter />
    </div>
  )
}
