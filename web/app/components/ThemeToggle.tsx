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
      className="rounded-lg border border-border-subtle bg-elevated px-2.5 py-1.5 text-xs font-medium text-muted shadow-sm transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {isDark ? txt.themeLight : txt.themeDark}
    </button>
  );
}
