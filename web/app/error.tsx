"use client";

/**
 * Catches runtime errors in the App Router segment tree so a failed page
 * does not leave the user on an empty white screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16">
      <p className="max-w-md text-center text-sm text-slate-700 dark:text-slate-200">
        {error.message || "Something went wrong while loading this page."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
      >
        Try again
      </button>
    </div>
  );
}
