import type { ReactNode } from "react";

type Tier = "hero" | "panel" | "inline";

type Props = {
  children: ReactNode;
  className?: string;
  tier?: Tier;
};

const tierClass: Record<Tier, string> = {
  hero: "surface-hero",
  panel: "surface-panel",
  inline: "surface-inline",
};

export default function Card({ children, className, tier = "panel" }: Props) {
  return (
    <article
      className={`${tierClass[tier]} p-5 transition-shadow duration-200 hover:shadow-card-hover md:p-6 ${className ?? ""}`}
    >
      {children}
    </article>
  );
}
