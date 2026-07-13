import { Suspense } from "react"

import PreferencesClient from "@/app/email/preferences/PreferencesClient"
import Skeleton from "@/app/components/ui/Skeleton"

export default function EmailPreferencesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-20 w-full" />}>
      <PreferencesClient />
    </Suspense>
  )
}

