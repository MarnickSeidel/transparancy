"use client"

import AppHeader from "@/app/components/AppHeader"
import type { Lang } from "@/lib/i18n"

type Props = {
  homeHref?: string
  lang: Lang
  onToggleLang: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
}

/** @deprecated Use AppHeader directly — kept for import compatibility */
export default function MarketingHeader({
  homeHref = "/",
  lang,
  onToggleLang,
}: Props) {
  return (
    <AppHeader
      variant="marketing"
      homeHref={homeHref}
      lang={lang}
      onToggleLang={onToggleLang}
    />
  )
}
