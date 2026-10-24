import type { Metadata } from "next"

import Button from "@/app/components/ui/Button"
import { noIndexMetadata } from "@/lib/seo"

export const metadata: Metadata = noIndexMetadata(
  "Suscripción cancelada",
  "Confirmación de cancelación de alertas de CasasClaras.",
)

type Props = {
  searchParams: { status?: string; lang?: string }
}

const copy = {
  es: {
    okTitle: "Suscripción cancelada",
    okBody: "Ya no recibirás los correos seleccionados. Puedes volver a suscribirte cuando quieras.",
    invalidTitle: "Enlace no válido",
    invalidBody: "No encontramos esta suscripción.",
    home: "Ir al inicio",
  },
  en: {
    okTitle: "Unsubscribed",
    okBody: "You will no longer receive the selected emails. You can subscribe again anytime.",
    invalidTitle: "Invalid link",
    invalidBody: "We could not find this subscription.",
    home: "Go home",
  },
}

export default function EmailUnsubscribedPage({ searchParams }: Props) {
  const ok = searchParams.status === "ok"
  const t = copy.es

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <main id="main-content" className="w-full max-w-md rounded-2xl border border-border-subtle bg-elevated p-8 shadow-card">
        <h1 className="text-display text-xl font-semibold text-foreground">
          {ok ? t.okTitle : t.invalidTitle}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {ok ? t.okBody : t.invalidBody}
        </p>
        <Button href="/" className="mt-6">
          {t.home}
        </Button>
      </main>
    </div>
  )
}
