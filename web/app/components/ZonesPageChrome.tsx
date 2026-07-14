"use client"

import PageFooter from "@/app/components/PageFooter"
import SiteHeader from "@/app/components/SiteHeader"
import type { Locale } from "@/lib/locale"
import { useUiLang } from "@/lib/useUiLang"

type Props = {
  locale: Locale
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function ZonesPageChrome({ locale, title, subtitle, children }: Props) {
  const { lang, toggleLang } = useUiLang(locale)

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={title}
        subtitle={subtitle}
        active="zones"
        lang={lang}
        onToggleLang={toggleLang}
      />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <PageFooter />
    </div>
  )
}
