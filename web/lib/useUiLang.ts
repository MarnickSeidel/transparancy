"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

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

let toolLangStore: Lang = "es";
let toolLangStoreReady = false;
const toolLangListeners = new Set<() => void>();

function subscribeToolLang(listener: () => void) {
  toolLangListeners.add(listener);
  return () => toolLangListeners.delete(listener);
}

function getToolLangSnapshot(): Lang {
  return toolLangStore;
}

function getToolLangServerSnapshot(): Lang {
  return "es";
}

function ensureToolLangStore(defaultLang: Lang) {
  if (typeof window === "undefined" || toolLangStoreReady) return;
  toolLangStoreReady = true;
  toolLangStore = readStoredLang() ?? defaultLang;
}

function setToolLangStore(next: Lang) {
  if (toolLangStore === next) return;
  toolLangStore = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, next);
  }
  toolLangListeners.forEach((listener) => listener());
}

/**
 * Sync UI language with URL locale on indexable routes; shared store on tool routes.
 */
export function useUiLang(defaultLang: Lang = "es") {
  const pathname = usePathname();
  const indexable = isIndexablePath(pathname);
  const urlLang = parseLocaleFromPath(pathname) as Lang;

  ensureToolLangStore(defaultLang);

  const toolLang = useSyncExternalStore(
    subscribeToolLang,
    getToolLangSnapshot,
    getToolLangServerSnapshot,
  );

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
    setToolLangStore(next);
  };

  const setLang = (next: Lang) => {
    if (indexable) {
      const target = switchLocalePath(pathname, next as Locale);
      if (target === pathname) return;
      window.location.assign(target);
      return;
    }
    setToolLangStore(next);
  };

  return { lang, setLang, toggleLang };
}
