"use client"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Avoid navigation hooks here — they can fail when the error boundary runs during a broken HMR state. */
export default function PageError({ error, reset }: Props) {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16">
      <h2 className="text-lg font-semibold text-foreground">
        Algo salió mal / Something went wrong
      </h2>
      <p className="max-w-md text-center text-sm text-muted">
        Recarga la página o reinicia el servidor de desarrollo con{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-xs">npm run dev:fresh</code>.
      </p>
      {error.message ? (
        <p className="max-w-md text-center text-xs text-muted/80">{error.message}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:opacity-90"
      >
        Reintentar / Retry
      </button>
    </div>
  )
}
