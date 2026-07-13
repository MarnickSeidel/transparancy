import type { Metadata } from "next";
import { notFound } from "next/navigation";

import TrustPageChrome from "@/app/components/TrustPageChrome";
import { type Locale, LOCALES } from "@/lib/locale";
import { trustPageMetadata } from "@/lib/trustSeo";

export const revalidate = 86400;

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return trustPageMetadata("privacy", params.locale as Locale);
}

export default function PrivacyPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  return (
    <TrustPageChrome locale={locale}>
      <h1 className="text-display text-3xl font-semibold text-foreground">
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
              If you submit an email, we store your address, selected topics (deal alerts, price
              drops, monthly market reports, quarterly Colombia overview), city preferences, and
              confirmation status. We send a double opt-in confirmation before any digest. Each email
              includes an unsubscribe link. Contact us to request full deletion.
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
              Si envías tu correo, guardamos la dirección, los temas elegidos (oportunidades, bajas
              de precio, resumen mensual del mercado, panorama trimestral de Colombia), ciudad y
              estado de confirmación. Enviamos un correo de confirmación antes de cualquier resumen.
              Cada correo incluye enlace para cancelar. Puedes solicitar eliminación total
              contactándonos.
            </p>
          </>
        )}
      </div>
    </TrustPageChrome>
  );
}
