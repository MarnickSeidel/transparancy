"use client";

import { useEffect, useRef, useState } from "react";

import { type Lang } from "@/lib/i18n";

const KEY = "ui_lang";

function readStoredLang(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "es" || v === "en" ? v : null;
}

/**
 * Keep initial `lang` aligned with SSR (always `defaultLang`), then sync from localStorage
 * in an effect — same pattern as useUiTheme — to avoid hydration mismatches on data-heavy pages.
 */
export function useUiLang(defaultLang: Lang = "es") {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const syncedRef = useRef(false);

  useEffect(() => {
    let next = lang;
    if (!syncedRef.current) {
      syncedRef.current = true;
      next = readStoredLang() ?? defaultLang;
      if (next !== lang) {
        setLang(next);
      }
    }
    window.localStorage.setItem(KEY, next);
    document.documentElement.lang = next;
  }, [lang, defaultLang]);

  const toggleLang = () => setLang((prev) => (prev === "es" ? "en" : "es"));

  return { lang, setLang, toggleLang };
}
