"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import {
  parseLocaleFromPath,
  switchLocalePath,
  type Locale,
} from "@/lib/locale"
import { type Lang } from "@/lib/i18n"

const KEY = "ui_lang"

/**
 * UI language follows the URL locale (/en/... = English, unprefixed = Spanish).
 */
export function useUiLang(defaultLang: Lang = "es") {
  const pathname = usePathname()
  const lang: Lang = pathname ? parseLocaleFromPath(pathname) : defaultLang

  useEffect(() => {
    window.localStorage.setItem(KEY, lang)
    document.documentElement.lang = lang === "en" ? "en" : "es"
  }, [lang])

  const toggleLang = () => {
    const next: Locale = lang === "es" ? "en" : "es"
    const target = switchLocalePath(pathname, next)
    if (target === pathname) return
    window.location.assign(target)
  }

  const setLang = (next: Lang) => {
    const target = switchLocalePath(pathname, next as Locale)
    if (target === pathname) return
    window.location.assign(target)
  }

  return { lang, setLang, toggleLang }
}
