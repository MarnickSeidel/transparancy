"use client";

import type { UiTheme } from "@/lib/useUiTheme";

type Props = {
  theme: UiTheme;
  onToggle: () => void;
};

export default function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full border border-slate-200 bg-elevated px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-surface"
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
