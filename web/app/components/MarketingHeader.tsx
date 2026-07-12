"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"

import LanguageToggle from "@/app/components/LanguageToggle"
import ThemeToggle from "@/app/components/ThemeToggle"
import Button from "@/app/components/ui/Button"
import { navItems } from "@/lib/navConfig"
import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

type Props = {
  homeHref?: string
  lang: Lang
  onToggleLang: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export default function MarketingHeader({
  homeHref = "/",
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
}: Props) {
  const txt = uiText[lang]
  const isDark = theme === "dark"
  const [menuOpen, setMenuOpen] = useState(false)

  const handleCloseMenu = () => setMenuOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/40 bg-background/80 backdrop-blur-md dark:border-slate-700/50">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="premium-surface rounded-2xl px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <Link href={homeHref} className="inline-flex shrink-0 items-center" onClick={handleCloseMenu}>
              {isDark ? (
                <span className="logo-on-dark">
                  <Image
                    src="/branding/habidata-logo-horizontal.png"
                    alt="Habidata"
                    width={210}
                    height={46}
                    className="h-8 w-auto object-contain sm:h-9"
                    priority
                  />
                </span>
              ) : (
                <Image
                  src="/branding/habidata-logo-horizontal.png"
                  alt="Habidata"
                  width={210}
                  height={46}
                  className="h-8 w-auto object-contain sm:h-9"
                  priority
                />
              )}
            </Link>

            <nav
              className="hidden items-center gap-1 lg:flex"
              aria-label={txt.menuLabel}
            >
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface hover:text-foreground"
                >
                  {txt[item.textKey]}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} lang={lang} onToggle={onToggleTheme} />
              <LanguageToggle lang={lang} onToggle={onToggleLang} />
              <Button href="/dashboard" className="hidden sm:inline-flex">
                {txt.openPlatform}
              </Button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-elevated text-foreground shadow-sm lg:hidden dark:border-slate-600"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? txt.navCloseMenu : txt.navOpenMenu}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="shrink-0 rounded-full border border-slate-200 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm dark:border-slate-600"
              >
                {txt[item.textKey]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          role="presentation"
          onClick={handleCloseMenu}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCloseMenu()
          }}
        />
      ) : null}

      {menuOpen ? (
        <nav
          className="fixed inset-x-4 top-[4.5rem] z-50 rounded-2xl border border-slate-200 bg-elevated p-4 shadow-xl dark:border-slate-700 lg:hidden"
          aria-label={txt.menuLabel}
        >
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-surface"
                  onClick={handleCloseMenu}
                >
                  {txt[item.textKey]}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard"
            className="mt-4 block w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-md"
            onClick={handleCloseMenu}
          >
            {txt.openPlatform}
          </Link>
        </nav>
      ) : null}
    </header>
  )
}
