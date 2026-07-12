"use client"

import { useState } from "react"

type Props = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const handleToggle = () => setOpen((v) => !v)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-surface/70 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface dark:border-slate-700/80"
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span>{title}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
