import type { Metadata } from "next"

import HomePage from "@/app/components/HomePage"
import { type Locale, LOCALES } from "@/lib/locale"
import { homeMetadata } from "@/lib/seo"
import { homeJsonLd } from "@/lib/trustSeo"

type Props = {
  params: { locale: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale as Locale
  return homeMetadata(locale)
}

export default function LocaleHomePage({ params }: Props) {
  const locale = params.locale as Locale
  if (!LOCALES.includes(locale)) return null

  const jsonLd = homeJsonLd(locale)

  return (
    <>
      {jsonLd.map((schema) => (
        <script
          key={schema["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <HomePage locale={locale} />
    </>
  )
}
