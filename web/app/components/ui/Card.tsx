import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className }: Props) {
  return (
    <article
      className={`premium-surface rounded-2xl p-6 transition-shadow duration-200 hover:shadow-card-hover ${className ?? ""}`}
    >
      {children}
    </article>
  );
}
