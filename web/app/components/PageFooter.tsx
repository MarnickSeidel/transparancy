"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import EmailSignupForm from "@/app/components/EmailSignupForm";
import { localePath, stripLocalePrefix, type Locale } from "@/lib/locale";
import { uiText } from "@/lib/i18n";

type Props = {
  locale?: Locale;
};

export default function PageFooter({ locale = "es" }: Props) {
  const pathname = usePathname();
  const txt = uiText[locale];
  const year = new Date().getFullYear();
  const lp = (path: string) => localePath(locale, path);
  const pathForLang = stripLocalePrefix(pathname || "/");

  return (
    <footer className="mt-auto border-t border-border-subtle bg-elevated/90">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Link
              href={lp("/")}
              className="text-display text-sm font-semibold text-foreground transition hover:text-accent"
            >
              Habidata
            </Link>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
              {txt.siteFooterTagline}
            </p>
          </div>
          <div>
            <p className="text-meta font-semibold">{locale === "en" ? "Explore" : "Explorar"}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={lp("/zones")} className="text-foreground hover:text-accent">
                  {txt.zonesNav}
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-foreground hover:text-accent">
                  {txt.exploreNav}
                </Link>
              </li>
              <li>
                <Link href="/opportunities" className="text-foreground hover:text-accent">
                  {txt.opportunitiesNav}
                </Link>
              </li>
              <li>
                <Link href="/price-drops" className="text-foreground hover:text-accent">
                  {txt.priceDropsNav}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-meta font-semibold">{locale === "en" ? "Trust" : "Confianza"}</p>
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
            <p className="text-meta font-semibold">{locale === "en" ? "Language" : "Idioma"}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={localePath("es", pathForLang)} className="text-foreground hover:text-accent">
                  Español
                </Link>
              </li>
              <li>
                <Link href={localePath("en", pathForLang)} className="text-foreground hover:text-accent">
                  English
                </Link>
              </li>
            </ul>
          </div>
          <EmailSignupForm
            lang={locale}
            source="footer"
            variant="footer"
            showCitySelect
            defaultLists={["market_monthly_city"]}
            visibleLists={["market_monthly_city", "market_quarterly_colombia"]}
            collapsedByDefault
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>
        <p className="mt-8 text-meta tabular-nums">© {year} Habidata · Finca Raíz data</p>
      </div>
    </footer>
  );
}
