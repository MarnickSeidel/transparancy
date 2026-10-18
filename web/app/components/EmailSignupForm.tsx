"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import { fetchJsonCached } from "@/lib/clientFetchCache"
import type { EmailList } from "@/lib/email/types"
import { cityDisplayName } from "@/lib/cityNames"
import { priorityCities, uiText, type Lang } from "@/lib/i18n"

type ListOption = {
  list: EmailList
  labelKey:
    | "emailPrefDealsCity"
    | "emailPrefDealsNeighborhood"
    | "emailPrefPriceDrops"
    | "emailPrefMarketMonthly"
    | "emailPrefMarketColombia"
  needsCity?: boolean
  needsNeighborhood?: boolean
}

const ALL_OPTIONS: ListOption[] = [
  { list: "deals_city", labelKey: "emailPrefDealsCity", needsCity: true },
  { list: "deals_neighborhood", labelKey: "emailPrefDealsNeighborhood", needsCity: true, needsNeighborhood: true },
  { list: "price_drops_city", labelKey: "emailPrefPriceDrops", needsCity: true },
  { list: "market_monthly_city", labelKey: "emailPrefMarketMonthly", needsCity: true },
  { list: "market_quarterly_colombia", labelKey: "emailPrefMarketColombia" },
]

/** Footer signup enrolls all city-scoped digests + Colombia quarterly. */
const FOOTER_ALL_LISTS: EmailList[] = [
  "deals_city",
  "price_drops_city",
  "market_monthly_city",
  "market_quarterly_colombia",
]

type Props = {
  lang: Lang
  source: string
  title?: string
  hint?: string
  defaultCity?: string
  defaultNeighborhood?: string
  defaultLists?: EmailList[]
  visibleLists?: EmailList[]
  showCitySelect?: boolean
  collapsedByDefault?: boolean
  variant?: "card" | "inline" | "footer-strip"
  className?: string
}

function fmtTemplate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
    template,
  )
}

export default function EmailSignupForm({
  lang,
  source,
  title,
  hint,
  defaultCity = "Pereira",
  defaultNeighborhood,
  defaultLists = ["deals_city", "market_monthly_city"],
  visibleLists,
  showCitySelect = false,
  collapsedByDefault = true,
  variant = "card",
  className = "",
}: Props) {
  const txt = uiText[lang]
  const privacyHref = lang === "en" ? "/en/privacy" : "/privacy"
  const isFooterStrip = variant === "footer-strip"

  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [city, setCity] = useState(defaultCity)
  const [cities, setCities] = useState<string[]>(priorityCities)
  const [selected, setSelected] = useState<Set<EmailList>>(() => new Set(defaultLists))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [devConfirmUrl, setDevConfirmUrl] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(!collapsedByDefault)

  const needsCityList = showCitySelect || isFooterStrip

  useEffect(() => {
    if (!needsCityList) return
    void fetchJsonCached<{ cities: string[] }>("/api/filters")
      .then((j) => {
        const list = j.cities?.filter((c) => c?.trim())
        if (list && list.length > 0) setCities(list)
      })
      .catch(() => {})
  }, [needsCityList])

  useEffect(() => {
    if (!needsCityList || cities.length === 0) return
    if (!cities.includes(city)) {
      const fallback = cities.includes(defaultCity) ? defaultCity : cities[0]
      setCity(fallback)
    }
  }, [cities, city, defaultCity, needsCityList])

  const options = useMemo(() => {
    const allowed = new Set(visibleLists ?? ALL_OPTIONS.map((o) => o.list))
    return ALL_OPTIONS.filter((opt) => {
      if (!allowed.has(opt.list)) return false
      if (opt.needsNeighborhood && !defaultNeighborhood) return false
      return true
    })
  }, [defaultNeighborhood, visibleLists])

  const resolvedTitle = title ?? (isFooterStrip ? txt.subscribeFooterTitle : txt.subscribeTitle)
  const resolvedHint =
    hint ??
    (isFooterStrip
      ? fmtTemplate(txt.subscribeFooterHint, { city })
      : defaultCity
        ? fmtTemplate(txt.estimateSubscribeHint, { city })
        : txt.subscribeHint)

  const handleToggle = (list: EmailList) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(list)) next.delete(list)
      else next.add(list)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setDevConfirmUrl(null)

    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(txt.subscribeInvalidEmail)
      return
    }

    const lists = isFooterStrip ? FOOTER_ALL_LISTS : Array.from(selected)
    if (lists.length === 0) {
      setError(txt.subscribePickOne)
      return
    }

    const preferences = lists.map((list) => ({
      list,
      city: list === "market_quarterly_colombia" ? null : city,
      neighborhood: list === "deals_neighborhood" ? defaultNeighborhood ?? null : null,
    }))

    setLoading(true)
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          locale: lang,
          source,
          city,
          preferences,
          company,
        }),
      })
      const j = (await res.json()) as {
        error?: string
        devConfirmUrl?: string
      }
      if (!res.ok) {
        if (res.status === 400 && j.error === "invalid_email") {
          setError(txt.subscribeInvalidEmail)
        } else if (res.status === 400 && j.error === "invalid_preferences") {
          setError(txt.subscribePickOne)
        } else {
          setError(txt.subscribeError)
        }
        return
      }
      setMessage(txt.subscribeSuccess)
      if (j.devConfirmUrl) {
        setDevConfirmUrl(j.devConfirmUrl)
        setMessage(txt.subscribeSuccessDev)
      }
      setEmail("")
    } catch {
      setError(txt.subscribeError)
    } finally {
      setLoading(false)
    }
  }

  const showPreferenceUi = !isFooterStrip && options.length > 1

  const formFields = (
    <div
      className={
        isFooterStrip
          ? "flex flex-col gap-2 sm:flex-row sm:items-stretch"
          : showCitySelect
            ? "grid gap-2 sm:grid-cols-[1fr_170px_auto]"
            : "grid gap-2 sm:grid-cols-[1fr_auto]"
      }
    >
      <div className={isFooterStrip ? "min-w-0 flex-1" : "sm:col-span-1"}>
        <label className="sr-only" htmlFor={`email-signup-${source}`}>
          {txt.subscribeEmailLabel}
        </label>
        <input
          id={`email-signup-${source}`}
          type="email"
          required
          autoComplete="email"
          className={inputClassName}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={txt.subscribeEmailPlaceholder}
        />
      </div>
      {needsCityList ? (
        <div className={isFooterStrip ? "w-full sm:w-44" : "sm:col-span-1"}>
          <label className="sr-only" htmlFor={`email-city-${source}`}>
            {txt.subscribeCityLabel}
          </label>
          <select
            id={`email-city-${source}`}
            className={inputClassName}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {cityDisplayName(c)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={loading}
        variant={isFooterStrip ? "primary" : "secondary"}
        className={`disabled:opacity-60 ${isFooterStrip ? "w-full shrink-0 sm:w-auto" : "w-full sm:w-auto"}`}
      >
        {loading ? txt.subscribeSending : txt.subscribeCta}
      </Button>
    </div>
  )

  const formInner = (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor={`email-company-${source}`}>Company</label>
        <input
          id={`email-company-${source}`}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      {formFields}

      {showPreferenceUi ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {lang === "en" ? "Email topics" : "Temas por email"}
            </p>
            <button
              type="button"
              onClick={() => setShowPrefs((v) => !v)}
              className="text-xs font-semibold text-accent hover:underline"
              aria-expanded={showPrefs}
            >
              {showPrefs ? (lang === "en" ? "Hide" : "Ocultar") : (lang === "en" ? "Customize" : "Personalizar")}
            </button>
          </div>

          {showPrefs ? (
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">{resolvedTitle}</legend>
              {options.map((opt) => (
                <label
                  key={opt.list}
                  className="group flex cursor-pointer items-start gap-2 rounded-xl border border-border-subtle/80 bg-surface/50 px-3 py-2.5 text-sm transition hover:border-accent/30 hover:bg-accent/5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.has(opt.list)}
                    onChange={() => handleToggle(opt.list)}
                  />
                  <span className="text-foreground">{txt[opt.labelKey]}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from(selected).slice(0, 3).map((l) => {
                const opt = options.find((o) => o.list === l)
                if (!opt) return null
                return (
                  <span
                    key={l}
                    className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    {txt[opt.labelKey]}
                  </span>
                )
              })}
              {selected.size > 3 ? (
                <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-foreground">
                  +{selected.size - 3}
                </span>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      <p className="text-xs text-muted">
        {isFooterStrip ? txt.subscribeFooterPrivacy : txt.emailPrivacyNote}{" "}
        <Link href={privacyHref} className="text-accent hover:underline">
          {lang === "en" ? "Privacy" : "Privacidad"}
        </Link>
      </p>

      {error ? (
        <p className="text-sm text-amber-900" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-800" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      {devConfirmUrl ? (
        <p className="break-all text-xs text-muted">
          <a href={devConfirmUrl} className="text-accent hover:underline">
            {devConfirmUrl}
          </a>
        </p>
      ) : null}
    </form>
  )

  if (variant === "inline") {
    return (
      <div className={className}>
        <h3 className="text-sm font-semibold text-foreground">{resolvedTitle}</h3>
        <p className="mt-1 text-xs text-muted">{resolvedHint}</p>
        <div className="mt-3">{formInner}</div>
      </div>
    )
  }

  if (isFooterStrip) {
    return (
      <div
        className={`rounded-2xl border border-border-subtle/80 bg-surface/40 px-4 py-5 sm:px-6 ${className}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 lg:max-w-sm">
            <p className="text-sm font-semibold text-foreground">{resolvedTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{resolvedHint}</p>
          </div>
          <div className="min-w-0 flex-1 lg:max-w-xl">{formInner}</div>
        </div>
      </div>
    )
  }

  return (
    <Card className={`border-border-subtle bg-surface/60 p-4 shadow-card sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{resolvedTitle}</h3>
      <p className="mt-1 text-xs text-muted">{resolvedHint}</p>
      <div className="mt-3">{formInner}</div>
    </Card>
  )
}
