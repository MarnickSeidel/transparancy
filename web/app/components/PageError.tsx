"use client";

import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useUiLang("es");
  const txt = uiText[lang];

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16">
      <h2 className="text-lg font-semibold text-foreground">{txt.errorPageTitle}</h2>
      <p className="max-w-md text-center text-sm text-muted">
        {txt.errorPageHint}
      </p>
      {error.message ? (
        <p className="max-w-md text-center text-xs text-muted/80">{error.message}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:opacity-90"
      >
        {txt.errorPageRetry}
      </button>
    </div>
  );
}
