"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import { inputClassName } from "@/app/components/ui/Field"
import type { EmailList } from "@/lib/email/types"
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

type Props = {
  lang: Lang
  source: string
  title?: string
  hint?: string
  defaultCity?: string
  defaultNeighborhood?: string
  defaultLists?: EmailList[]
  /** Controls which checkboxes are shown (order preserved). */
  visibleLists?: EmailList[]
  showCitySelect?: boolean
  collapsedByDefault?: boolean
  variant?: "card" | "inline" | "footer"
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

  const [email, setEmail] = useState("")
  const [city, setCity] = useState(defaultCity)
  const [selected, setSelected] = useState<Set<EmailList>>(() => new Set(defaultLists))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [devConfirmUrl, setDevConfirmUrl] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(!collapsedByDefault)

  const options = useMemo(() => {
    const allowed = new Set(visibleLists ?? ALL_OPTIONS.map((o) => o.list))
    return ALL_OPTIONS.filter((opt) => {
      if (!allowed.has(opt.list)) return false
      if (opt.needsNeighborhood && !defaultNeighborhood) return false
      return true
    })
  }, [defaultNeighborhood, visibleLists])

  const resolvedTitle = title ?? txt.subscribeTitle
  const resolvedHint =
    hint ??
    (defaultCity
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
    if (selected.size === 0) {
      setError(txt.subscribePickOne)
      return
    }

    const preferences = Array.from(selected).map((list) => ({
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

  const formInner = (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div
        className={
          variant === "footer"
            ? "grid gap-2 sm:grid-cols-[1fr_170px_auto]"
            : "grid gap-2 sm:grid-cols-[1fr_auto]"
        }
      >
        <div className="sm:col-span-1">
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
        {showCitySelect ? (
          <div className="sm:col-span-1">
            <label className="sr-only" htmlFor={`email-city-${source}`}>
              {txt.subscribeCityLabel}
            </label>
            <select
              id={`email-city-${source}`}
              className={inputClassName}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {priorityCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button
          type="submit"
          disabled={loading}
          variant={variant === "footer" ? "primary" : "secondary"}
          className="w-full sm:w-auto disabled:opacity-60"
        >
          {loading ? txt.subscribeSending : txt.subscribeCta}
        </Button>
      </div>

      {options.length > 1 ? (
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
      ) : null}

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

      <p className="text-xs text-muted">
        {txt.emailPrivacyNote}{" "}
        <Link href={privacyHref} className="text-accent hover:underline">
          {lang === "en" ? "Privacy" : "Privacidad"}
        </Link>
      </p>

      {error ? <p className="text-sm text-amber-900">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
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

  if (variant === "footer") {
    return (
      <div className={className}>
        <p className="text-meta font-semibold">{resolvedTitle}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{txt.subscribeHint}</p>
        <div className="mt-3">{formInner}</div>
      </div>
    )
  }

  return (
    <Card className={`border-slate-200/70 bg-slate-50/60 p-4 shadow-card dark:border-slate-700/70 dark:bg-slate-900/20 sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{resolvedTitle}</h3>
      <p className="mt-1 text-xs text-muted">{resolvedHint}</p>
      <div className="mt-3">{formInner}</div>
    </Card>
  )
}
