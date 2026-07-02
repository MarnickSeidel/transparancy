import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type BaseProps = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
};

type ButtonProps = BaseProps & {
  href?: never;
} & ButtonHTMLAttributes<HTMLButtonElement>;

type LinkProps = BaseProps & { href: string };

type Props = ButtonProps | LinkProps;

function styles(variant: Variant, className?: string) {
  const base =
    "rounded-xl px-5 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60";
  const byVariant =
    variant === "primary"
      ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-900/20 hover:from-teal-500 hover:to-cyan-500"
      : "border border-slate-300 bg-white/80 text-slate-700 hover:border-slate-400 hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800";
  return `${base} ${byVariant} ${className ?? ""}`.trim();
}

export default function Button(props: Props) {
  if ("href" in props) {
    const { href, children, variant, className } = props as LinkProps;
    const cls = styles(variant ?? "primary", className);
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  const { children, type, variant, className, ...domProps } = props as ButtonProps;
  const cls = styles(variant ?? "primary", className);
  return (
    <button type={type ?? "button"} className={cls} {...domProps}>
      {children}
    </button>
  );
}
