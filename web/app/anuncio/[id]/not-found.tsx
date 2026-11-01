import Link from "next/link"

import PageFooter from "@/app/components/PageFooter"
import Button from "@/app/components/ui/Button"
import { uiText } from "@/lib/i18n"
import { opportunitiesPath } from "@/lib/locale"

export default function ListingNotFound() {
  const txt = uiText.es

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center sm:px-6">
        <h1 className="text-display text-2xl font-semibold text-foreground">
          {txt.listingDetailNotFound}
        </h1>
        <p className="mt-3 text-muted">{txt.listingDetailNotFoundBody}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href={opportunitiesPath("es")}>{txt.listingDetailBack}</Button>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-accent hover:underline">
            LupaCasa
          </Link>
        </div>
      </main>
      <PageFooter />
    </div>
  )
}
