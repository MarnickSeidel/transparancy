import Link from "next/link";

import type { Lang } from "@/lib/i18n";

type Props = {
  items: Array<{ label: string; href: string }>;
  lang?: Lang;
};

export default function Breadcrumbs({ items, lang = "es" }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={lang === "en" ? "Breadcrumb" : "Migas de pan"} className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.href}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span aria-hidden className="text-slate-300 dark:text-slate-600">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="font-medium text-accent hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
