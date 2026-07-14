type Props = {
  message: string
  className?: string
}

export default function ErrorBanner({ message, className = "" }: Props) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={`rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 ${className}`.trim()}
    >
      {message}
    </div>
  )
}
