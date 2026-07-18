"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import BrandLogo from "@/app/components/BrandLogo"
import LanguageToggle from "@/app/components/LanguageToggle"
import ThemeToggle from "@/app/components/ThemeToggle"
import Button from "@/app/components/ui/Button"
import {
  moreNavItems,
  navItems,
  primaryNavItems,
  type NavItem,
  type NavKey,
} from "@/lib/navConfig"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { resolveNavHref } from "@/lib/locale"
import { BRAND_NAME } from "@/lib/brand"
import { useUiTheme } from "@/lib/useUiTheme"

type HeaderText = {
  menuLabel: string
  dashboardNav: string
  estimateNav: string
  opportunitiesNav: string
  exploreNav: string
  zonesNav: string
  heatmapNav: string
  analyzeUrlNav: string
  analyzeUrlCta: string
  priceDropsNav: string
  navMore: string
  navOpenMenu: string
  navCloseMenu: string
  openPlatform: string
}

type Props = {
  /** Marketing home — slim bar without page title */
  variant?: "marketing" | "tool"
  homeHref?: string
  /** Tool pages: page title below nav */
  title?: string
  subtitle?: string
  active?: NavKey
  lang: Lang
  onToggleLang: () => void
  /** Legacy: pass uiText slice for tool pages */
  txt?: HeaderText
}

export default function AppHeader({
  variant = "tool",
  homeHref = "/",
  title,
  subtitle,
  active,
  lang,
  onToggleLang,
  txt: txtProp,
}: Props) {
  const txt = txtProp ?? uiText[lang]
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggleTheme } = useUiTheme("light")
  const isDark = theme === "dark"
  const isMarketing = variant === "marketing"
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreDesktopRef = useRef<HTMLDivElement>(null)
  const moreMobileRef = useRef<HTMLDivElement>(null)

  const isMoreActive = moreNavItems.some((item) => item.key === active)

  useEffect(() => {
    setPendingHref(null)
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(resolveNavHref(item.href, lang))
    })
  }, [router, lang])

  useEffect(() => {
    if (!moreOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        moreDesktopRef.current?.contains(target) ||
        moreMobileRef.current?.contains(target)
      ) {
        return
      }
      setMoreOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [moreOpen])

  const handlePrefetch = useCallback(
    (href: string) => {
      router.prefetch(href)
    },
    [router],
  )

  const navLinkClass = (key: NavKey, href: string, compact = false) => {
    const isActive = key === active
    const isPending = pendingHref === href
    const padding = compact ? "px-2.5 py-1.5" : "px-3 py-1.5"
    if (isActive) {
      return `shrink-0 rounded-lg bg-accent ${padding} text-xs font-semibold text-accent-fg shadow-sm`
    }
    if (isPending) {
      return `shrink-0 rounded-lg bg-accent/15 ${padding} text-xs font-semibold text-accent ring-2 ring-accent/50 animate-pulse`
    }
    return `shrink-0 rounded-lg ${padding} text-xs font-medium text-foreground/80 transition hover:bg-surface hover:text-foreground`
  }

  const moreTriggerClass = () => {
    if (isMoreActive) {
      return "inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm"
    }
    if (moreOpen) {
      return "inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-accent/30"
    }
    return "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-surface hover:text-foreground"
  }

  const renderNavLink = (item: NavItem, compact = false) => {
    const href = resolveNavHref(item.href, lang)
    return (
      <Link
        key={item.key}
        href={href}
        className={navLinkClass(item.key, href, compact)}
        aria-current={item.key === active ? "page" : undefined}
        aria-busy={pendingHref === href ? true : undefined}
        onMouseEnter={() => handlePrefetch(href)}
        onFocus={() => handlePrefetch(href)}
        onClick={() => {
          setPendingHref(href)
          setMoreOpen(false)
        }}
      >
        {txt[item.textKey]}
      </Link>
    )
  }

  const renderMorePanel = (className: string, menuId?: string) => (
    <div id={menuId} className={className} role="menu">
      {moreNavItems.map((item) => {
        const href = resolveNavHref(item.href, lang)
        const isActive = item.key === active
        return (
          <Link
            key={item.key}
            href={href}
            role="menuitem"
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition link-focus ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-foreground hover:bg-surface"
            }`}
            aria-current={isActive ? "page" : undefined}
            onMouseEnter={() => handlePrefetch(href)}
            onFocus={() => handlePrefetch(href)}
            onClick={() => {
              setPendingHref(href)
              setMoreOpen(false)
            }}
          >
            {txt[item.textKey]}
          </Link>
        )
      })}
    </div>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={homeHref}
            className="inline-flex shrink-0 items-center link-focus"
            aria-label={BRAND_NAME}
          >
            <BrandLogo isDark={isDark} />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={txt.menuLabel}>
            {primaryNavItems.map((item) => renderNavLink(item))}
            <div ref={moreDesktopRef} className="relative">
              <button
                type="button"
                className={`${moreTriggerClass()} link-focus`}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-controls="nav-more-menu"
                onClick={() => setMoreOpen((open) => !open)}
              >
                {txt.navMore}
                <svg
                  className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {moreOpen
                ? renderMorePanel(
                    "absolute right-0 top-full z-50 mt-1.5 min-w-[12.5rem] rounded-xl border border-border-subtle bg-elevated p-1.5 shadow-card",
                    "nav-more-menu",
                  )
                : null}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} lang={lang} onToggle={toggleTheme} />
            <LanguageToggle lang={lang} onToggle={onToggleLang} />
            {isMarketing ? (
              <Button href={resolveNavHref("/analyze-url", lang)} className="hidden sm:inline-flex">
                {txt.analyzeUrlCta}
              </Button>
            ) : null}
          </div>
        </div>

        <div ref={moreMobileRef} className="lg:hidden">
          <nav className="mt-2 flex items-center gap-1" aria-label={txt.menuLabel}>
            {primaryNavItems.map((item) => renderNavLink(item, true))}
            <button
              type="button"
              className={`${moreTriggerClass()} link-focus`}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-controls="nav-more-menu-mobile"
              onClick={() => setMoreOpen((open) => !open)}
            >
              {txt.navMore}
              <svg
                className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>

          {moreOpen ? (
            <div id="nav-more-menu-mobile" className="mt-2">
              {renderMorePanel(
                "grid gap-0.5 rounded-xl border border-border-subtle bg-elevated p-1.5 shadow-card sm:grid-cols-2",
              )}
            </div>
          ) : null}
        </div>

        {!isMarketing && title ? (
          <div className="mt-4 border-t border-border-subtle/50 pt-4">
            <h1 className="text-display text-2xl font-semibold md:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{subtitle}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
