import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Badge({ children, className }: Props) {
  return (
    <span
      className={`inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-700 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
