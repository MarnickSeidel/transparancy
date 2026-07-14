"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { localePath, opportunitiesPath, stripLocalePrefix } from "@/lib/locale";
import { BRAND_COPY, BRAND_NAME } from "@/lib/brand";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

const EmailSignupForm = dynamic(() => import("@/app/components/EmailSignupForm"), {
  ssr: false,
  loading: () => (
    <div className="mt-10 h-24 animate-pulse rounded-2xl border border-border-subtle bg-surface/60" />
  ),
});

export default function PageFooter() {
  const pathname = usePathname();
  const { lang: locale } = useUiLang("es");
  const txt = uiText[locale];
  const year = new Date().getFullYear();
  const lp = (path: string) => localePath(locale, path);
  const pathForLang = stripLocalePrefix(pathname || "/");

  return (
    <footer className="mt-auto border-t border-border-subtle bg-elevated/90">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href={lp("/")}
              className="text-display link-focus text-sm font-semibold text-foreground transition hover:text-accent"
            >
              {BRAND_NAME}
            </Link>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">
              {locale === "en" ? BRAND_COPY.en.footerTagline : BRAND_COPY.es.footerTagline}
            </p>
          </div>
          <div>
            <p className="text-meta font-semibold">{locale === "en" ? "Explore" : "Explorar"}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={lp("/zones")} className="link-focus text-foreground hover:text-accent">
                  {txt.zonesNav}
                </Link>
              </li>
              <li>
                <Link href={lp("/explore")} className="link-focus text-foreground hover:text-accent">
                  {txt.exploreNav}
                </Link>
              </li>
              <li>
                <Link href={opportunitiesPath(locale)} className="link-focus text-foreground hover:text-accent">
                  {txt.opportunitiesNav}
                </Link>
              </li>
              <li>
                <Link href={lp("/price-drops")} className="link-focus text-foreground hover:text-accent">
                  {txt.priceDropsNav}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-meta font-semibold">{locale === "en" ? "Trust" : "Confianza"}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={lp("/methodology")} className="link-focus text-foreground hover:text-accent">
                  {locale === "en" ? "Methodology" : "Metodología"}
                </Link>
              </li>
              <li>
                <Link href={lp("/about")} className="link-focus text-foreground hover:text-accent">
                  {locale === "en" ? "About" : "Acerca de"}
                </Link>
              </li>
              <li>
                <Link href={lp("/privacy")} className="link-focus text-foreground hover:text-accent">
                  {locale === "en" ? "Privacy" : "Privacidad"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-meta font-semibold">{locale === "en" ? "Language" : "Idioma"}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={localePath("es", pathForLang)} className="link-focus text-foreground hover:text-accent">
                  Español
                </Link>
              </li>
              <li>
                <Link href={localePath("en", pathForLang)} className="link-focus text-foreground hover:text-accent">
                  English
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <EmailSignupForm
          lang={locale}
          source="footer"
          variant="footer-strip"
          className="mt-10"
        />

        <p className="mt-8 text-meta tabular-nums">© {year} {BRAND_NAME} · Finca Raíz data</p>
      </div>
    </footer>
  );
}
