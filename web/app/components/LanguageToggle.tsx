"use client";

import type { Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
  onToggle: () => void;
};

export default function LanguageToggle({ lang, onToggle }: Props) {
  const ariaLabel =
    lang === "es" ? "Cambiar idioma a ingles" : "Switch language to Spanish"

  return (
    <button
      type="button"
      className="rounded-full border border-slate-200 bg-elevated px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-surface dark:border-slate-600 dark:text-slate-200"
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <span className="inline-flex items-center gap-2">
        {lang === "es" ? (
          <>
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <rect width="14" height="5" fill="#FCD116" />
                <rect y="5" width="14" height="2.5" fill="#003893" />
                <rect y="7.5" width="14" height="2.5" fill="#CE1126" />
              </svg>
              ES
            </span>
            <span>|</span>
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <rect width="14" height="10" fill="#B22234" />
                <rect y="1.15" width="14" height="0.77" fill="#fff" />
                <rect y="2.69" width="14" height="0.77" fill="#fff" />
                <rect y="4.23" width="14" height="0.77" fill="#fff" />
                <rect y="5.77" width="14" height="0.77" fill="#fff" />
                <rect y="7.31" width="14" height="0.77" fill="#fff" />
                <rect y="8.85" width="14" height="0.77" fill="#fff" />
                <rect width="6.2" height="5.4" fill="#3C3B6E" />
              </svg>
              EN
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <rect width="14" height="10" fill="#B22234" />
                <rect y="1.15" width="14" height="0.77" fill="#fff" />
                <rect y="2.69" width="14" height="0.77" fill="#fff" />
                <rect y="4.23" width="14" height="0.77" fill="#fff" />
                <rect y="5.77" width="14" height="0.77" fill="#fff" />
                <rect y="7.31" width="14" height="0.77" fill="#fff" />
                <rect y="8.85" width="14" height="0.77" fill="#fff" />
                <rect width="6.2" height="5.4" fill="#3C3B6E" />
              </svg>
              EN
            </span>
            <span>|</span>
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                <rect width="14" height="5" fill="#FCD116" />
                <rect y="5" width="14" height="2.5" fill="#003893" />
                <rect y="7.5" width="14" height="2.5" fill="#CE1126" />
              </svg>
              ES
            </span>
          </>
        )}
      </span>
    </button>
  );
}
