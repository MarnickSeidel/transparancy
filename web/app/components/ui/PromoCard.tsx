import type { ReactNode } from "react"

import Card from "@/app/components/ui/Card"
import Button from "@/app/components/ui/Button"

type Props = {
  title: string
  description: string
  href: string
  cta: string
  className?: string
  children?: ReactNode
}

export default function PromoCard({
  title,
  description,
  href,
  cta,
  className = "",
  children,
}: Props) {
  return (
    <Card
      className={`border-accent-secondary/30 bg-surface/80 shadow-card dark:border-accent-secondary/40 dark:bg-surface/40 ${className}`.trim()}
    >
      <h2 className="text-display text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {children}
      <Button href={href} className="mt-4">
        {cta}
      </Button>
    </Card>
  )
}
