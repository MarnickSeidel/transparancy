import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageFooter from "@/app/components/PageFooter";
import { localePath, type Locale, LOCALES } from "@/lib/locale";
import { trustPageMetadata } from "@/lib/trustSeo";

export const revalidate = 86400;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("privacy", params.locale as Locale);
}

export default function PrivacyPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const lp = (path: string) => localePath(locale, path);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Link href={lp("/")} className="text-sm font-semibold text-accent hover:underline">
          ← Habidata
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-foreground">
          {locale === "en" ? "Privacy policy" : "Política de privacidad"}
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          {locale === "en" ? (
            <>
              <p>
                Habidata is an analytics platform. We do not sell personal data. This policy describes
                what we store in your browser and what we collect if you subscribe to updates.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Local storage</h2>
              <p>
                We store UI preferences (language, theme) in your browser&apos;s localStorage. No account
                is required to browse public pages.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Listing data</h2>
              <p>
                Aggregated statistics come from publicly visible Finca Raíz advertisements. We do not
                publish seller contact details on indexable pages.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Email subscription</h2>
              <p>
                If you submit an email via our subscribe form, it is stored to send product updates.
                Contact us to request deletion.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
              <p>
                We may use privacy-respecting analytics in production to understand usage. No decision
                is final — check this page for updates.
              </p>
            </>
          ) : (
            <>
              <p>
                Habidata es una plataforma de analítica. No vendemos datos personales. Esta política
                describe qué guardamos en tu navegador y qué recopilamos si te suscribes.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Almacenamiento local</h2>
              <p>
                Guardamos preferencias de interfaz (idioma, tema) en localStorage. No se requiere cuenta
                para navegar páginas públicas.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Datos de anuncios</h2>
              <p>
                Las estadísticas provienen de anuncios públicos de Finca Raíz. No publicamos datos de
                contacto del vendedor en páginas indexables.
              </p>
              <h2 className="text-lg font-semibold text-foreground">Suscripción por email</h2>
              <p>
                Si envías un email en el formulario de suscripción, se almacena para enviar novedades.
                Puedes solicitar eliminación contactándonos.
              </p>
            </>
          )}
        </div>
      </main>
      <PageFooter locale={locale} />
    </div>
  );
}
