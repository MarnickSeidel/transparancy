"use client";

import type { Lang } from "@/lib/i18n";
import { uiText } from "@/lib/i18n";
import type { UiTheme } from "@/lib/useUiTheme";

type Props = {
  theme: UiTheme;
  lang?: Lang;
  onToggle: () => void;
};

export default function ThemeToggle({ theme, lang = "es", onToggle }: Props) {
  const txt = uiText[lang];
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? txt.themeSwitchToLight : txt.themeSwitchToDark}
      className="rounded-full border border-slate-200 bg-elevated px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-surface dark:border-slate-600 dark:text-slate-200"
    >
      {isDark ? txt.themeLight : txt.themeDark}
    </button>
  );
}
