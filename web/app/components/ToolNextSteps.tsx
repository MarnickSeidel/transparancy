import Link from "next/link"

export type ToolNextStep = {
  title: string
  description: string
  href: string
  cta: string
}

type Props = {
  title: string
  steps: ToolNextStep[]
  className?: string
}

export default function ToolNextSteps({ title, steps, className = "" }: Props) {
  if (steps.length === 0) return null

  return (
    <section
      className={`mt-10 ${className}`.trim()}
      aria-labelledby="tool-next-steps-heading"
    >
      <h2 id="tool-next-steps-heading" className="text-display text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="surface-panel block p-5 transition hover:border-accent/35 hover:shadow-card-hover link-focus"
          >
            <h3 className="text-display text-base font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
            <span className="mt-4 inline-flex text-sm font-semibold text-accent">{step.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
