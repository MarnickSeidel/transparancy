import { Suspense } from "react"
import type { Metadata } from "next"

import PreferencesClient from "@/app/email/preferences/PreferencesClient"
import Skeleton from "@/app/components/ui/Skeleton"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata(
  "Preferencias de email",
  "Administra tus alertas y resúmenes de ClaraCasas.",
)

export default function EmailPreferencesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-20 w-full" />}>
      <PreferencesClient />
    </Suspense>
  )
}

