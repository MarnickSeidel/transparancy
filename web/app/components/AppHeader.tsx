"use client"

import Link from "next/link"
import Image from "next/image"
import { Fragment, useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import LanguageToggle from "@/app/components/LanguageToggle"
import ThemeToggle from "@/app/components/ThemeToggle"
import Button from "@/app/components/ui/Button"
import { navGroups, navItems, type NavKey } from "@/lib/navConfig"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"
import { resolveNavHref } from "@/lib/locale"
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
  priceDropsNav: string
  navOpenMenu: string
  navCloseMenu: string
  openPlatform: string
  navGroupResearch: string
  navGroupAnalyze: string
  navGroupMarket: string
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

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    navItems.forEach((item) => {
      router.prefetch(resolveNavHref(item.href, lang))
    })
  }, [router, lang])

  const handlePrefetch = useCallback(
    (href: string) => {
      router.prefetch(href)
    },
    [router],
  )

  const navLinkClass = (key: NavKey, href: string) => {
    const isActive = key === active
    const isPending = pendingHref === href
    if (isActive) {
      return "shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm"
    }
    if (isPending) {
      return "shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground/60 ring-1 ring-accent/30"
    }
    return "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-surface hover:text-foreground"
  }

  const renderNavLink = (item: (typeof navItems)[number]) => {
    const href = resolveNavHref(item.href, lang)
    return (
    <Link
      key={item.key}
      href={href}
      className={navLinkClass(item.key, href)}
      aria-current={item.key === active ? "page" : undefined}
      aria-busy={pendingHref === href ? true : undefined}
      onMouseEnter={() => handlePrefetch(href)}
      onFocus={() => handlePrefetch(href)}
      onClick={() => setPendingHref(href)}
    >
      {txt[item.textKey]}
    </Link>
  )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href={homeHref} className="inline-flex shrink-0 items-center link-focus">
            {isDark ? (
              <span className="logo-on-dark">
                <Image
                  src="/branding/habidata-logo-horizontal.svg"
                  alt="Habidata"
                  width={200}
                  height={44}
                  className="h-8 w-auto object-contain sm:h-9"
                  priority
                />
              </span>
            ) : (
              <Image
                src="/branding/habidata-logo-horizontal.svg"
                alt="Habidata"
                width={200}
                height={44}
                className="h-8 w-auto object-contain sm:h-9"
                priority
              />
            )}
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={txt.menuLabel}>
            {navGroups.map((group, groupIndex) => (
              <Fragment key={group.id}>
                {groupIndex > 0 ? (
                  <span
                    className="mx-1.5 hidden h-4 w-px shrink-0 bg-border-subtle xl:inline"
                    aria-hidden
                  />
                ) : null}
                {group.items.map((item) => renderNavLink(item))}
              </Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} lang={lang} onToggle={toggleTheme} />
            <LanguageToggle lang={lang} onToggle={onToggleLang} />
            {isMarketing ? (
              <Button href="/analyze-url" className="hidden sm:inline-flex">
                {txt.analyzeUrlNav}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Mobile / tablet: every destination is a link (no hidden items, no fake group labels) */}
        <nav
          className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={txt.menuLabel}
        >
          {navItems.map((item) => renderNavLink(item))}
        </nav>

        {/* Tool page title — separate from nav chrome */}
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
