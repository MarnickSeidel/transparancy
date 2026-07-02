/** Shared placeholder while client-only app routes load (avoids SSR/hydration issues). */
export default function AppShellLoading() {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center px-4">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/80" />
      <p className="mt-4 text-sm text-muted">Loading…</p>
    </div>
  );
}
