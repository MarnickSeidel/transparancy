"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const router = useRouter();
  const urlLang = parseLocaleFromPath(pathname) as Lang;
  const [lang, setLang] = useState<Lang>(defaultLang);
  const syncedRef = useRef(false);

  useEffect(() => {
    let next = lang;
    if (!syncedRef.current) {
      syncedRef.current = true;
      if (isIndexablePath(pathname)) {
        next = urlLang;
      } else {
        next = readStoredLang() ?? defaultLang;
      }
      if (next !== lang) setLang(next);
    } else if (isIndexablePath(pathname)) {
      next = urlLang;
      if (next !== lang) setLang(next);
    }
    window.localStorage.setItem(KEY, next);
    document.documentElement.lang = next === "en" ? "en" : "es";
  }, [lang, defaultLang, pathname, urlLang]);

  const toggleLang = () => {
    const next: Locale = lang === "es" ? "en" : "es";
    if (isIndexablePath(pathname)) {
      router.push(switchLocalePath(pathname, next));
    } else {
      setLang(next);
    }
  };

  return { lang, setLang, toggleLang };
}
