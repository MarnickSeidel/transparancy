"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import Button from "@/app/components/ui/Button"
import Card from "@/app/components/ui/Card"
import Skeleton from "@/app/components/ui/Skeleton"
import type { EmailList, EmailPreference } from "@prisma/client"
import { uiText, type Lang } from "@/lib/i18n"

type ApiResponse =
  | {
      contact: { email: string; locale: string; status: string }
      preferences: EmailPreference[]
    }
  | { error: string }

const LABEL_KEY: Record<
  EmailList,
  | "emailPrefDealsCity"
  | "emailPrefDealsNeighborhood"
  | "emailPrefPriceDrops"
  | "emailPrefMarketMonthly"
  | "emailPrefMarketColombia"
> = {
  deals_city: "emailPrefDealsCity",
  deals_neighborhood: "emailPrefDealsNeighborhood",
  price_drops_city: "emailPrefPriceDrops",
  market_monthly_city: "emailPrefMarketMonthly",
  market_quarterly_colombia: "emailPrefMarketColombia",
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@")
  if (!user || !domain) return email
  const head = user.slice(0, 2)
  const tail = user.slice(-1)
  return `${head}***${tail}@${domain}`
}

export default function PreferencesClient() {
  const search = useSearchParams()
  const token = search.get("token")?.trim() || ""

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const lang: Lang = "es"
  const [email, setEmail] = useState<string>("")
  const [prefs, setPrefs] = useState<EmailPreference[]>([])

  const txt = uiText[lang]

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError("Falta el token.")
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    fetch(`/api/email/preferences?token=${encodeURIComponent(token)}`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((j) => {
        if ("error" in j) {
          setError(j.error)
          return
        }
        setEmail(j.contact.email)
        setPrefs(j.preferences)
      })
      .catch(() => setError(txt.couldNotLoad))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const grouped = useMemo(() => {
    return prefs.map((p) => {
      const scope =
        p.neighborhood && p.city ? `${p.neighborhood}, ${p.city}` : p.city ? p.city : ""
      return { ...p, scope }
    })
  }, [prefs])

  const handleToggle = (id: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    )
  }

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/email/preferences?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: prefs.map((p) => ({
            list: p.list,
            city: p.city,
            neighborhood: p.neighborhood,
            active: p.active,
          })),
        }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(j.error ?? txt.subscribeError)
        return
      }
      setMessage("Guardado.")
    } catch {
      setError(txt.subscribeError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <main id="main-content" className="w-full max-w-2xl">
        <h1 className="text-display text-2xl font-semibold text-foreground">
          Preferencias de email
        </h1>
        <p className="mt-2 text-sm text-muted">
          {email ? "Para" : null}{" "}
          <span className="font-semibold text-foreground">{email ? maskEmail(email) : "—"}</span>
        </p>

        <Card className="mt-6 border-slate-200/70 bg-slate-50/60 p-5 shadow-card dark:border-slate-700/70 dark:bg-slate-900/20">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {grouped.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-border-subtle/80 bg-surface/50 px-3 py-2.5 text-sm transition hover:border-accent/30 hover:bg-accent/5"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={p.active}
                      onChange={() => handleToggle(p.id)}
                    />
                    <span className="text-foreground">
                      {txt[LABEL_KEY[p.list]]}
                      {p.scope ? <span className="text-muted"> · {p.scope}</span> : null}
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">{txt.emailPrivacyNote}</p>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="w-full sm:w-auto disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>

              {error ? <p className="mt-3 text-sm text-amber-900">{String(error)}</p> : null}
              {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
            </>
          )}
        </Card>
      </main>
    </div>
  )
}

