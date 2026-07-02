"use client";

import Link from "next/link";

import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

export default function PageFooter() {
  const { lang } = useUiLang("es");
  const txt = uiText[lang];
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-elevated/80 backdrop-blur-sm dark:border-slate-600/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Link
            href="/"
            className="text-sm font-semibold text-slate-800 transition hover:text-teal-600 dark:text-slate-100 dark:hover:text-teal-400"
          >
            Habidata
          </Link>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">{txt.siteFooterTagline}</p>
        </div>
        <p className="text-xs tabular-nums text-muted">© {year}</p>
      </div>
    </footer>
  );
}
