"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import SiteHeader from "@/app/components/SiteHeader";
import Card from "@/app/components/ui/Card";
import Skeleton from "@/app/components/ui/Skeleton";
import { buildFincaRaizSearchUrl } from "@/lib/fincaraizSearch";
import {
  DEFAULT_MIN_ZONE_DATA_POINTS,
  isApartmentType,
  isHouseType,
  type ZoneConfidence,
} from "@/lib/zones";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

const MonthlyTrendChart = dynamic(() => import("@/app/components/MonthlyTrendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full rounded-2xl" />,
});

type ZoneDossierData = {
  slug: string;
  displayName: string;
  city: string;
  citySlug: string;
  listingCount: number;
  dataPointCount: number;
  medianPricePerM2: number | null;
  medianPriceCop: number | null;
  published: boolean;
  minDataPoints: number;
  opportunityCount: number;
  dominantConfidence: ZoneConfidence;
  confidenceMix: Record<string, number>;
  propertyTypes: Array<{
    type: string;
    count: number;
    medianPricePerM2: number | null;
  }>;
  aliases: Array<{ label: string; count: number }>;
  exploreNeighborhood: string;
  monthlyTrend: Array<{ month: string; sample: number; medianPpm2: number | null }>;
};

type Props = {
  citySlug: string;
  zoneSlug: string;
};

type PropertyTab = "all" | "apt" | "house";

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—";
  return `$ ${Math.round(v).toLocaleString(locale)}`;
}

function fmtTemplate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const CONFIDENCE_LABELS: Record<string, { es: string; en: string }> = {
  catalog: { es: "Catálogo", en: "Catalog" },
  source_id: { es: "ID Finca Raíz", en: "Finca Raíz ID" },
  provisional: { es: "Provisional", en: "Provisional" },
  weak: { es: "Débil", en: "Weak" },
  missing: { es: "Sin barrio", en: "Missing" },
};

const CONFIDENCE_BADGE: Record<ZoneConfidence, string> = {
  catalog: "bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60",
  source_id: "bg-teal-100 text-teal-900 ring-teal-200/80 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/60",
  provisional: "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60",
  weak: "bg-orange-100 text-orange-900 ring-orange-200/80 dark:bg-orange-950/50 dark:text-orange-200 dark:ring-orange-800/60",
  missing: "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/60",
};

export default function ZoneDossier({ citySlug, zoneSlug }: Props) {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [data, setData] = useState<ZoneDossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyTab, setPropertyTab] = useState<PropertyTab>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(
        `/api/zones/${encodeURIComponent(citySlug)}/${encodeURIComponent(zoneSlug)}?minDataPoints=${DEFAULT_MIN_ZONE_DATA_POINTS}`,
      );
      if (res.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }
      if (!res.ok && res.status !== 202) throw new Error("load");
      setData((await res.json()) as ZoneDossierData);
    } catch {
      setError(txt.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [citySlug, zoneSlug, txt.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const exploreHref = useMemo(() => {
    if (!data) return "/explore";
    const p = new URLSearchParams();
    p.set("city", data.city);
    p.set("neighborhood", data.exploreNeighborhood);
    return `/explore?${p.toString()}`;
  }, [data]);

  const opportunitiesHref = useMemo(() => {
    if (!data) return "/opportunities";
    const p = new URLSearchParams();
    p.set("city", data.city);
    p.set("neighborhood", data.exploreNeighborhood);
    return `/opportunities?${p.toString()}`;
  }, [data]);

  const fincaRaizHref = useMemo(() => {
    if (!data) return null;
    return buildFincaRaizSearchUrl(data.city, data.exploreNeighborhood);
  }, [data]);

  const chartRows = useMemo(
    () =>
      (data?.monthlyTrend ?? []).map((row) => ({
        month: row.month,
        sample: row.sample,
        medianPpm2: row.medianPpm2,
        p25: null,
        p75: null,
        minSampleMet: true,
      })),
    [data?.monthlyTrend],
  );

  const confidenceRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.confidenceMix)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filteredPropertyTypes = useMemo(() => {
    if (!data) return [];
    if (propertyTab === "apt") {
      return data.propertyTypes.filter((r) => isApartmentType(r.type));
    }
    if (propertyTab === "house") {
      return data.propertyTypes.filter((r) => isHouseType(r.type));
    }
    return data.propertyTypes;
  }, [data, propertyTab]);

  const title = data?.displayName ?? zoneSlug;
  const published = data?.published !== false;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={loading ? txt.loadingData : title}
        subtitle={data ? `${data.city} · ${txt.zonesPurpose}` : undefined}
        active="zones"
        lang={lang}
        onToggleLang={toggleLang}
        txt={txt}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-6">
          <Link
            href="/zones"
            className="text-sm font-medium text-accent hover:underline"
          >
            {txt.zonesBackToList}
          </Link>
        </p>

        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            {error}
          </div>
        ) : null}

        {notFound ? (
          <Card>
            <p className="text-sm text-muted">{txt.zonesNotFound}</p>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-40 rounded-2xl lg:col-span-3" />
            <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : data ? (
          <>
            {!published ? (
              <Card className="mb-6 border-amber-200/80 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
                <h2 className="text-lg font-semibold text-foreground">{txt.zonesUnpublishedTitle}</h2>
                <p className="mt-2 text-sm text-foreground">
                  {fmtTemplate(txt.zonesUnpublishedBody, {
                    n: data.dataPointCount,
                    min: data.minDataPoints,
                  })}
                </p>
                <p className="mt-2 text-xs text-muted">{txt.zonesUnpublishedWhy}</p>
              </Card>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${CONFIDENCE_BADGE[data.dominantConfidence]}`}
              >
                {txt.zonesConfidenceBadge}: {CONFIDENCE_LABELS[data.dominantConfidence]?.[lang] ?? data.dominantConfidence}
              </span>
              {data.opportunityCount > 0 ? (
                <Link
                  href={opportunitiesHref}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  {fmtTemplate(txt.zonesDealsInBarrio, { n: data.opportunityCount })} · {txt.zonesDealsLink}
                </Link>
              ) : null}
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesActiveListings}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {data.listingCount.toLocaleString(locale)}
                </p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesDataPoints}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {data.dataPointCount.toLocaleString(locale)}
                </p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesMedianPpm2}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-accent">
                  {fmtCop(data.medianPricePerM2, locale)}
                </p>
              </Card>
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesMedianPrice}
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {fmtCop(data.medianPriceCop, locale)}
                </p>
              </Card>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    {txt.zonesPropertyMix}
                  </h2>
                  <div className="flex gap-1 rounded-xl border border-slate-200/90 bg-surface/60 p-1 dark:border-slate-700/80">
                    {(
                      [
                        ["all", txt.zonesTabAll],
                        ["apt", txt.zonesTabApt],
                        ["house", txt.zonesTabHouse],
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        className={
                          propertyTab === tab
                            ? "rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-fg"
                            : "rounded-lg px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
                        }
                        onClick={() => setPropertyTab(tab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredPropertyTypes.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{txt.noDataForFilters}</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-muted dark:border-slate-700">
                          <th className="pb-2 pr-4">{txt.type}</th>
                          <th className="pb-2 pr-4">{txt.count}</th>
                          <th className="pb-2">{txt.pricePerM2}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPropertyTypes.map((row) => (
                          <tr
                            key={row.type}
                            className="border-b border-slate-100 dark:border-slate-800"
                          >
                            <td className="py-2 pr-4 font-medium text-foreground">
                              {row.type}
                            </td>
                            <td className="py-2 pr-4 tabular-nums text-muted">
                              {row.count.toLocaleString(locale)}
                            </td>
                            <td className="py-2 tabular-nums text-accent">
                              {fmtCop(row.medianPricePerM2, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesConfidence}
                </h2>
                <ul className="mt-4 space-y-2 text-sm">
                  {confidenceRows.map(([key, count]) => (
                    <li key={key} className="flex items-center justify-between gap-3">
                      <span className="text-foreground">
                        {CONFIDENCE_LABELS[key]?.[lang] ?? key}
                      </span>
                      <span className="tabular-nums font-medium text-muted">
                        {count.toLocaleString(locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {data.aliases.length > 0 ? (
              <Card className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesAliases}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {data.aliases.map((a) => a.label).join(" · ")}
                </p>
              </Card>
            ) : null}

            {published && chartRows.length >= 1 ? (
              <Card className="mb-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                  {txt.zonesMonthlyTrend}
                </h2>
                <MonthlyTrendChart
                  rows={chartRows}
                  locale={locale}
                  noDataLabel={txt.monthlyChartNoData}
                  tooltipLabel={txt.monthlyMedianTooltipLabel}
                />
              </Card>
            ) : null}

            <Card className="border-teal-200/80 bg-teal-50/40 dark:border-teal-900/60 dark:bg-teal-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={exploreHref}
                  className="inline-flex text-base font-semibold text-accent hover:underline"
                >
                  {fmtTemplate(txt.zonesExploreCta, { barrio: data.displayName })} →
                </Link>
                {fincaRaizHref ? (
                  <a
                    href={fincaRaizHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-base font-semibold text-accent hover:underline"
                  >
                    {fmtTemplate(txt.zonesFincaRaizCta, { barrio: data.displayName })} →
                  </a>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}
      </main>

      <PageFooter />
    </div>
  );
}
