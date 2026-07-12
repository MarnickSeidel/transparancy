"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  isIndexablePath,
  parseLocaleFromPath,
  switchLocalePath,
  type Locale,
} from "@/lib/locale";
import { type Lang } from "@/lib/i18n";

const KEY = "ui_lang";

function readStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "es" || v === "en" ? v : null;
}

/**
 * Sync UI language with URL locale on indexable routes; localStorage elsewhere.
 */
export function useUiLang(defaultLang: Lang = "es") {
  const pathname = usePathname();
  const indexable = isIndexablePath(pathname);
  const urlLang = parseLocaleFromPath(pathname) as Lang;
  const [toolLang, setToolLang] = useState<Lang>(() => readStoredLang() ?? defaultLang);

  const lang: Lang = indexable ? urlLang : toolLang;

  useEffect(() => {
    window.localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang === "en" ? "en" : "es";
  }, [lang]);

  const toggleLang = () => {
    const current: Locale = indexable ? parseLocaleFromPath(pathname) : toolLang;
    const next: Locale = current === "es" ? "en" : "es";
    if (indexable) {
      const target = switchLocalePath(pathname, next);
      if (target === pathname) return;
      window.location.assign(target);
      return;
    }
    setToolLang(next);
  };

  const setLang = (next: Lang) => {
    if (indexable) {
      const target = switchLocalePath(pathname, next as Locale);
      if (target === pathname) return;
      window.location.assign(target);
      return;
    }
    setToolLang(next);
  };

  return { lang, setLang, toggleLang };
}
