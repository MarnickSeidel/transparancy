import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TrustPageChrome from "@/app/components/TrustPageChrome";
import { methodologyContent, methodologyFaqJsonLdFromCopy } from "@/lib/methodologyCopy";
import { type Locale, LOCALES } from "@/lib/locale";
import { trustPageMetadata } from "@/lib/trustSeo";

export const revalidate = 86400;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("methodology", params.locale as Locale);
}

export default function MethodologyPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const copy = methodologyContent[locale];
  const faqJsonLd = methodologyFaqJsonLdFromCopy(locale);

  return (
    <TrustPageChrome locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h1 className="text-display text-3xl font-semibold text-foreground">{copy.title}</h1>
      <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
        <p className="text-muted leading-relaxed">{copy.intro}</p>
        {copy.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="mt-8 text-xl font-semibold text-foreground">{section.heading}</h2>
            <p className="text-muted leading-relaxed">{section.body}</p>
          </div>
        ))}
        <h2 className="mt-8 text-xl font-semibold text-foreground">
          {copy.limitationsHeading}
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
          {copy.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">{copy.faqHeading}</h2>
        <dl className="mt-6 space-y-6">
          {copy.faqs.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-semibold text-foreground">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </TrustPageChrome>
  );
}
