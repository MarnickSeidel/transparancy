import Link from "next/link";

import { localePath, type Locale } from "@/lib/locale";
import { uiText } from "@/lib/i18n";

type Props = {
  locale?: Locale;
};

export default function PageFooter({ locale = "es" }: Props) {
  const txt = uiText[locale];
  const year = new Date().getFullYear();
  const lp = (path: string) => localePath(locale, path);

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-elevated/80 backdrop-blur-sm dark:border-slate-600/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href={lp("/")}
              className="text-sm font-semibold text-slate-800 transition hover:text-teal-600 dark:text-slate-100 dark:hover:text-teal-400"
            >
              Habidata
            </Link>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
              {txt.siteFooterTagline}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {locale === "en" ? "Explore" : "Explorar"}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={lp("/zones")} className="text-foreground hover:text-accent">
                  {txt.zonesNav}
                </Link>
              </li>
              <li>
                <Link href={lp("/")} className="text-foreground hover:text-accent">
                  {locale === "en" ? "Home" : "Inicio"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {locale === "en" ? "Trust" : "Confianza"}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={lp("/methodology")} className="text-foreground hover:text-accent">
                  {locale === "en" ? "Methodology" : "Metodología"}
                </Link>
              </li>
              <li>
                <Link href={lp("/about")} className="text-foreground hover:text-accent">
                  {locale === "en" ? "About" : "Acerca de"}
                </Link>
              </li>
              <li>
                <Link href={lp("/privacy")} className="text-foreground hover:text-accent">
                  {locale === "en" ? "Privacy" : "Privacidad"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {locale === "en" ? "Language" : "Idioma"}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/" className="text-foreground hover:text-accent">
                  Español
                </Link>
              </li>
              <li>
                <Link href="/en" className="text-foreground hover:text-accent">
                  English
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-xs tabular-nums text-muted">© {year} Habidata</p>
      </div>
    </footer>
  );
}
