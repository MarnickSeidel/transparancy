"use client";

import Link from "next/link";
import Image from "next/image";

import LanguageToggle from "@/app/components/LanguageToggle";
import type { Lang } from "@/lib/i18n";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useUiTheme } from "@/lib/useUiTheme";

type NavKey = "dashboard" | "estimate" | "opportunities" | "analyzeUrl";

type HeaderText = {
  menuLabel: string;
  dashboardNav: string;
  estimateNav: string;
  opportunitiesNav: string;
  analyzeUrlNav: string;
};

type Props = {
  title: string;
  subtitle?: string;
  active: NavKey;
  lang: Lang;
  onToggleLang: () => void;
  txt: HeaderText;
};

const navItems: Array<{ key: NavKey; href: string; textKey: keyof HeaderText }> = [
  { key: "dashboard", href: "/dashboard", textKey: "dashboardNav" },
  { key: "estimate", href: "/estimate", textKey: "estimateNav" },
  { key: "opportunities", href: "/opportunities", textKey: "opportunitiesNav" },
  { key: "analyzeUrl", href: "/analyze-url", textKey: "analyzeUrlNav" },
];

export default function SiteHeader({
  title,
  subtitle,
  active,
  lang,
  onToggleLang,
  txt,
}: Props) {
  const { theme, toggleTheme } = useUiTheme("light");
  const isDark = theme === "dark";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/40 bg-background/80 backdrop-blur-md dark:border-slate-700/50 dark:bg-background/90">
      <div className="mx-auto max-w-7xl px-4 pb-3 pt-4 sm:px-6 lg:px-8">
        <div className="premium-surface rounded-2xl px-5 py-5 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center">
              {isDark ? (
                <span className="logo-on-dark">
                  <Image
                    src="/branding/habidata-logo-horizontal.png"
                    alt="Habidata"
                    width={220}
                    height={48}
                    className="h-9 w-auto object-contain"
                    priority
                  />
                </span>
              ) : (
                <Image
                  src="/branding/habidata-logo-horizontal.png"
                  alt="Habidata"
                  width={220}
                  height={48}
                  className="h-9 w-auto object-contain"
                  priority
                />
              )}
            </Link>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                {txt.menuLabel}
              </span>
              {navItems.map((item) => {
                const isActive = item.key === active;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={
                      isActive
                        ? "rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        : "rounded-full border border-slate-200 bg-elevated px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-surface dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700/80"
                    }
                  >
                    {txt[item.textKey]}
                  </Link>
                );
              })}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 md:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted md:text-[15px]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <LanguageToggle lang={lang} onToggle={onToggleLang} />
          </div>
        </div>
        </div>
      </div>
    </header>
  );
}
