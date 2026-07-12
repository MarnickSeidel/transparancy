"use client"

import Link from "next/link"

import { uiText } from "@/lib/i18n"
import { useUiLang } from "@/lib/useUiLang"

export default function PageFooter() {
  const { lang } = useUiLang("es")
  const txt = uiText[lang]
  const year = new Date().getFullYear()

  const links = [
    { href: "/explore", label: txt.footerExplore },
    { href: "/opportunities", label: txt.footerOpportunities },
    { href: "/analyze-url", label: txt.footerAnalyze },
    { href: "/zones", label: txt.zonesNav },
    { href: "/dashboard", label: txt.dashboardNav },
  ]

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-elevated/80 backdrop-blur-sm dark:border-slate-600/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold text-foreground transition hover:text-teal-600 dark:hover:text-teal-400"
            >
              Habidata
            </Link>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              {txt.siteFooterTagline}
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2"
            aria-label={lang === "es" ? "Enlaces del sitio" : "Site links"}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-muted transition hover:text-teal-600 dark:hover:text-teal-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs tabular-nums text-muted">© {year} Habidata</p>
      </div>
    </footer>
  )
}
