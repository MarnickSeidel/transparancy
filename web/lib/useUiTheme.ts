"use client";

import { useEffect, useRef, useState } from "react";

export type UiTheme = "light" | "dark";

const KEY = "ui_theme";

function readStoredTheme(): UiTheme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

function readSystemTheme(): UiTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Theme must match between server and the first client render, or hydration fails (white screen).
 * We always start from `defaultTheme`, then sync from localStorage / system in an effect.
 */
export function useUiTheme(defaultTheme: UiTheme = "light") {
  const [theme, setTheme] = useState<UiTheme>(defaultTheme);
  const syncedRef = useRef(false);

  useEffect(() => {
    let next = theme;
    if (!syncedRef.current) {
      syncedRef.current = true;
      next = readStoredTheme() ?? readSystemTheme();
      if (next !== theme) {
        setTheme(next);
      }
    }
    window.localStorage.setItem(KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggleTheme };
}
