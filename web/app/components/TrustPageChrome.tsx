"use client"

import AppHeader from "@/app/components/AppHeader"
import PageFooter from "@/app/components/PageFooter"
import { localePath, type Locale } from "@/lib/locale"
import { useUiLang } from "@/lib/useUiLang"

type Props = {
  locale: Locale
  children: React.ReactNode
}

export default function TrustPageChrome({ locale, children }: Props) {
  const { lang, toggleLang } = useUiLang(locale)

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppHeader variant="marketing" homeHref={localePath(lang, "/")} lang={lang} onToggleLang={toggleLang} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">{children}</main>
      <PageFooter locale={lang} />
    </div>
  )
}
