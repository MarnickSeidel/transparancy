import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        elevated: "var(--elevated)",
        muted: "var(--text-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          fg: "var(--accent-fg)",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgb(15 23 42 / 0.06), 0 4px 12px rgb(15 23 42 / 0.04)",
        "card-hover":
          "0 4px 6px rgb(15 23 42 / 0.05), 0 12px 24px rgb(15 23 42 / 0.06)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s ease-out both",
        "fade-up-delay": "fade-up 0.55s ease-out 0.08s both",
        "fade-up-delay-2": "fade-up 0.55s ease-out 0.16s both",
      },
    },
  },
  plugins: [],
};
export default config;
