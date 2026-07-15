import type { Metadata } from "next"

import Button from "@/app/components/ui/Button"
import { noIndexMetadata } from "@/lib/seo"
import { absoluteUrl } from "@/lib/siteUrl"

export const metadata: Metadata = noIndexMetadata(
  "Correo confirmado",
  "Confirmación de suscripción a alertas de ClaraCasas.",
)

type Props = {
  searchParams: { status?: string; lang?: string }
}

const copy = {
  es: {
    okTitle: "Correo confirmado",
    okBody: "Tu suscripción está activa. Te enviaremos los resúmenes que elegiste después de cada actualización de datos.",
    invalidTitle: "Enlace no válido",
    invalidBody: "Este enlace expiró o ya fue usado. Puedes suscribirte de nuevo desde el sitio.",
    home: "Ir al inicio",
    zones: "Explorar barrios",
  },
  en: {
    okTitle: "Email confirmed",
    okBody: "Your subscription is active. We will send the digests you selected after each data refresh.",
    invalidTitle: "Invalid link",
    invalidBody: "This link expired or was already used. You can subscribe again from the site.",
    home: "Go home",
    zones: "Browse neighborhoods",
  },
}

export default function EmailConfirmedPage({ searchParams }: Props) {
  const lang = searchParams.lang === "en" ? "en" : "es"
  const ok = searchParams.status === "ok"
  const t = copy[lang]

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <main id="main-content" className="w-full max-w-md rounded-2xl border border-border-subtle bg-elevated p-8 shadow-card">
        <h1 className="text-display text-xl font-semibold text-foreground">
          {ok ? t.okTitle : t.invalidTitle}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {ok ? t.okBody : t.invalidBody}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button href={lang === "en" ? "/en" : "/"}>{t.home}</Button>
          <Button href={lang === "en" ? "/en/zones" : "/zones"} variant="secondary">
            {t.zones}
          </Button>
        </div>
      </main>
      <p className="mt-6 text-meta text-xs">{absoluteUrl("/")}</p>
    </div>
  )
}
