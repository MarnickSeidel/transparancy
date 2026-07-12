import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "good" | "warn" | "bad";
};

const variantClass: Record<NonNullable<Props["variant"]>, string> = {
  default:
    "border-border-subtle bg-surface text-accent-secondary",
  good:
    "border-deal-good/30 bg-deal-good/10 text-deal-good",
  warn:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  bad:
    "border-deal-bad/30 bg-deal-bad/10 text-deal-bad",
};

export default function Badge({ children, className, variant = "default" }: Props) {
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-semibold ${variantClass[variant]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
