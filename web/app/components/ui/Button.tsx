import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

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
    "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";
  const byVariant: Record<Variant, string> = {
    primary:
      "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover",
    secondary:
      "border border-border-subtle bg-elevated text-foreground hover:bg-surface",
    ghost:
      "text-foreground hover:bg-surface",
  };
  return `${base} ${byVariant[variant]} ${className ?? ""}`.trim();
}

export default function Button(props: Props) {
  if ("href" in props) {
    const { href, children, variant, className } = props as LinkProps;
    return (
      <Link href={href} className={styles(variant ?? "primary", className)}>
        {children}
      </Link>
    );
  }
  const { children, type, variant, className, ...domProps } = props as ButtonProps;
  return (
    <button type={type ?? "button"} className={styles(variant ?? "primary", className)} {...domProps}>
      {children}
    </button>
  );
}
