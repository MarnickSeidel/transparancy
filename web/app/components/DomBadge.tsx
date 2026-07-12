import type { Lang } from "@/lib/i18n"
import { domBadgeTone } from "@/lib/formatDom"

type Props = {
  days: number | null | undefined
  lang: Lang
  label: string
  className?: string
}

const toneClass: Record<ReturnType<typeof domBadgeTone>, string> = {
  new: "bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60",
  normal: "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/60",
  aging: "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60",
  stale: "bg-orange-100 text-orange-900 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800/60",
}

export default function DomBadge({ days, lang, label, className = "" }: Props) {
  if (!label) return null
  const tone = domBadgeTone(days)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${toneClass[tone]} ${className}`}
      title={lang === "es" ? "Días en mercado" : "Days on market"}
    >
      {label}
    </span>
  )
}
