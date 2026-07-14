"use client"

import AppHeader from "@/app/components/AppHeader"
import Skeleton from "@/app/components/ui/Skeleton"
import { useUiLang } from "@/lib/useUiLang"

/** Nav stays interactive while a tool route loads — avoids full-screen lock during fast clicks. */
export default function ToolPageFallback() {
  const { lang, toggleLang } = useUiLang("es")

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppHeader variant="tool" lang={lang} onToggleLang={toggleLang} />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </main>
    </div>
  )
}
