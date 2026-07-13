"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EmailSignupForm from "@/app/components/EmailSignupForm";
import PageFooter from "./PageFooter";
import CollapsibleSection from "./CollapsibleSection";
import SiteHeader from "./SiteHeader";
import Skeleton from "./ui/Skeleton";
import TrustMeta from "./TrustMeta";
import { fetchJsonCached } from "@/lib/clientFetchCache";
import { MIN_SAMPLE_SIZE } from "@/lib/analytics";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";
import { DEFAULT_ZONE_CITY } from "@/lib/zones";

/** Recharts measures the DOM; rendering on the server breaks hydration and can blank the app. */
const MonthlyTrendChart = dynamic(() => import("./MonthlyTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center px-2 pb-2 pt-4">
      <Skeleton className="h-52 w-full max-w-4xl" />
    </div>
  ),
});

const NULL_TYPE = "__NULL__";

type Summary = {
  avgPricePerM2Pereira: number | null;
  avgPricePerM2City?: number | null;
  medianPricePerM2City?: number | null;
  p25PricePerM2City?: number | null;
  p75PricePerM2City?: number | null;
  iqrPricePerM2City?: number | null;
  sampleSizePricePerM2?: number;
  minSampleMet?: boolean;
  minSampleSize?: number;
  coveragePricePerM2Pct?: number;
  outlierRule?: string;
  cityScope?: string;
  totalListings: number;
  activeListings?: number;
  inactiveListings?: number;
  catalogTotal?: number;
  listingsScrapedToday: number;
  listingsNewToday?: number;
  coverageEstratoPct?: number;
  coverageGeoPct?: number;
};

type TypeStatRow = {
  type: string | null;
  count: number;
  medianPpm2: number | null;
  p25: number | null;
  p75: number | null;
  medianArea: number | null;
};

type NeighborhoodStatRow = {
  name: string | null;
  count: number;
  sampleSize: number;
  minSampleMet: boolean;
  medianPpm2: number | null;
  p25: number | null;
  p75: number | null;
  deltaPct: number | null;
};

type EstratoTypeMatrix = {
  types: string[];
  rows: Array<{
    estrato: number;
    cells: Array<{ type: string; count: number; medianPpm2: number | null }>;
  }>;
};

type PricingIntel = {
  cityMedian: number;
  expectedPpm2: number;
  lowBand: number;
  highBand: number;
  drivers: Array<{
    label: string;
    name: string | null;
    impactPct: number;
    sample: number;
  }>;
};

type MonthlyTrendRow = {
  month: string;
  sample: number;
  medianPpm2: number | null;
  p25: number | null;
  p75: number | null;
  minSampleMet: boolean;
};

function fmtCop(n: number | null | undefined, locale: string) {
  if (n == null || Number.isNaN(n)) return "—";
  return `$ ${Math.round(n).toLocaleString(locale)}`;
}

function matrixTypeLabel(t: string, unknownLabel: string) {
  return t === NULL_TYPE ? unknownLabel : t;
}

export default function Dashboard() {
  const { lang, toggleLang } = useUiLang("es");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [typeStats, setTypeStats] = useState<TypeStatRow[]>([]);
  const [neighborhoodStats, setNeighborhoodStats] = useState<NeighborhoodStatRow[]>(
    [],
  );
  const [estratoTypeMatrix, setEstratoTypeMatrix] = useState<EstratoTypeMatrix>({
    types: [],
    rows: [],
  });
  const [pricingIntelligence, setPricingIntelligence] = useState<PricingIntel | null>(
    null,
  );
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [estratos, setEstratos] = useState<number[]>([]);
  const [city, setCity] = useState(DEFAULT_ZONE_CITY);
  const [estrato, setEstrato] = useState("all");
  const [neighborhood, setNeighborhood] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyTrendRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const isFirstLoad = useRef(true);
  const locale = lang === "es" ? "es-CO" : "en-US";
  const txt = uiText[lang];

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (city !== "all") p.set("city", city);
    if (estrato !== "all") p.set("estrato", estrato);
    if (neighborhood !== "all") p.set("neighborhood", neighborhood);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [city, estrato, neighborhood]);

  const qualifiedMonthlyStats = useMemo(
    () => monthlyStats.filter((r) => r.minSampleMet && r.medianPpm2 != null),
    [monthlyStats],
  );

  const monthlyNarrative = useMemo(() => {
    if (qualifiedMonthlyStats.length < 2) return null;
    const current = qualifiedMonthlyStats[qualifiedMonthlyStats.length - 1];
    const previous = qualifiedMonthlyStats[qualifiedMonthlyStats.length - 2];
    const momPct =
      current.medianPpm2 != null && previous.medianPpm2 != null && previous.medianPpm2 > 0
        ? ((current.medianPpm2 - previous.medianPpm2) / previous.medianPpm2) * 100
        : null;
    const threeMonthBase =
      qualifiedMonthlyStats.length >= 4
        ? qualifiedMonthlyStats[qualifiedMonthlyStats.length - 4].medianPpm2
        : null;
    const trend3mPct =
      current.medianPpm2 != null && threeMonthBase != null && threeMonthBase > 0
        ? ((current.medianPpm2 - threeMonthBase) / threeMonthBase) * 100
        : null;
    return { current, previous, momPct, trend3mPct };
  }, [qualifiedMonthlyStats]);

  const heroLine = useMemo(() => {
    const moms = monthlyNarrative?.momPct;
    if (moms == null || Number.isNaN(moms)) return txt.dashboardHeroNarrativeNoData;
    if (Math.abs(moms) < 0.05) return txt.dashboardHeroNarrativeStable;
    if (moms > 0) return txt.dashboardHeroNarrativeUp.replace("{pct}", moms.toFixed(1));
    return txt.dashboardHeroNarrativeDown.replace("{pct}", Math.abs(moms).toFixed(1));
  }, [monthlyNarrative, txt]);

  const investmentGate = useMemo(() => {
    const monthsWithSample = monthlyStats.filter((r) => r.minSampleMet).length;
    const enoughMonthlyHistory = monthsWithSample >= 4;
    const enoughCoverage = (summary?.coveragePricePerM2Pct ?? 0) >= 60;
    const enoughSample = (summary?.sampleSizePricePerM2 ?? 0) >= MIN_SAMPLE_SIZE;
    const ready = enoughMonthlyHistory && enoughCoverage && enoughSample;
    return { ready, enoughMonthlyHistory, enoughCoverage, enoughSample };
  }, [monthlyStats, summary?.coveragePricePerM2Pct, summary?.sampleSizePricePerM2]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (isFirstLoad.current) setLoading(true);
    setError(null);
    try {
      const bundleQs = qs ? `${qs}&months=6` : "?months=6";
      const json = await fetchJsonCached<{
        summary: Summary;
        filters?: { cities?: string[]; neighborhoods?: string[]; estratos?: number[] };
        typeStats?: TypeStatRow[];
        neighborhoodStats?: NeighborhoodStatRow[];
        estratoTypeMatrix?: EstratoTypeMatrix;
        pricingIntelligence?: PricingIntel | null;
        monthlyTrends?: { rows?: MonthlyTrendRow[] };
      }>(`/api/dashboard/bundle${bundleQs}`);
      if (signal?.aborted) return;
      setSummary(json.summary);
      setCities(json.filters?.cities ?? []);
      setNeighborhoods(json.filters?.neighborhoods ?? []);
      setEstratos(json.filters?.estratos ?? []);
      setTypeStats((json.typeStats ?? []) as TypeStatRow[]);
      setNeighborhoodStats((json.neighborhoodStats ?? []) as NeighborhoodStatRow[]);
      setEstratoTypeMatrix(
        (json.estratoTypeMatrix ?? { types: [], rows: [] }) as EstratoTypeMatrix,
      );
      setPricingIntelligence((json.pricingIntelligence ?? null) as PricingIntel | null);
      setMonthlyStats((json.monthlyTrends?.rows ?? []) as MonthlyTrendRow[]);
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(uiText[lang].couldNotLoad);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, [qs, lang]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.title}
        subtitle={txt.dashboardPurpose}
        active="dashboard"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            {error}
          </div>
        )}

        <section className="mb-6 surface-hero p-6 md:p-8">
          <p className="text-section-label">{txt.dashboardSnapshot}</p>
          <p className="mt-1 text-meta">
            {txt.medianPriceM2} (
            {summary?.cityScope === "all" ? txt.allCities : (summary?.cityScope ?? txt.cityLabel)})
          </p>
          {loading ? (
            <Skeleton className="mt-4 h-14 w-full max-w-md" />
          ) : (
          <p className="text-data-hero mt-3">
            {(summary?.medianPricePerM2City ?? summary?.avgPricePerM2City ?? summary?.avgPricePerM2Pereira) != null
              ? `$ ${Math.round(
                  summary?.medianPricePerM2City ??
                    summary?.avgPricePerM2City ??
                    summary?.avgPricePerM2Pereira ??
                    0,
                ).toLocaleString(locale)}`
              : "—"}
          </p>
          )}
          <p className="mt-2 text-lg text-muted md:text-xl">
            {txt.p25p75Band}:{" "}
            {loading
              ? "…"
              : summary?.p25PricePerM2City != null && summary?.p75PricePerM2City != null
                ? `${fmtCop(summary?.p25PricePerM2City, locale)} – ${fmtCop(summary?.p75PricePerM2City, locale)}`
                : "—"}
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
            {heroLine}
          </p>
          <TrustMeta
            className="mt-4"
            sampleSize={summary?.sampleSizePricePerM2}
            minSample={summary?.minSampleSize ?? MIN_SAMPLE_SIZE}
            updatedAt={lastUpdatedAt ? lastUpdatedAt.toLocaleString(locale) : null}
            source="Finca Raíz"
            labels={{
              sample: txt.sample,
              confidence: txt.quality,
              updated: txt.dashboardLastUpdated,
              source: txt.dashboardDataSource,
            }}
          />
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="kpi-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {txt.activeListings}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? "…" : (summary?.activeListings ?? summary?.totalListings ?? "—")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {txt.catalogTotal}:{" "}
              {loading ? "…" : (summary?.catalogTotal ?? summary?.totalListings ?? "—")}
            </p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {txt.inactiveListings}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? "…" : (summary?.inactiveListings ?? "—")}
            </p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {txt.newTodayUtc}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? "…" : (summary?.listingsNewToday ?? "—")}
            </p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {txt.coveragePriceM2}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading
                ? "…"
                : `${(summary?.coveragePricePerM2Pct ?? 0).toFixed(1)}%`}
            </p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {txt.kpiQualityCheck}
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? "…" : summary?.minSampleMet ? txt.pass : txt.lowSample}
            </p>
            <p className="mt-1 text-xs text-muted">
              n={(summary?.sampleSizePricePerM2 ?? 0)} (min {summary?.minSampleSize ?? MIN_SAMPLE_SIZE}), outlier:{" "}
              {summary?.outlierRule ?? "n/a"}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200/90 bg-elevated p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{txt.dashboardNextActions}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/opportunities"
              className="rounded-xl border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
            >
              {txt.dashboardSeeOpportunities}
            </Link>
            <Link
              href="/estimate"
              className="rounded-xl border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
            >
              {txt.dashboardOpenEstimator}
            </Link>
          </div>
        </section>

        <section className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/90 bg-elevated p-4 shadow-card">
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="dashboard-city-filter">
              {txt.city}
            </label>
            <select
              id="dashboard-city-filter"
              className="mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-elevated px-3 py-2.5 text-sm shadow-sm"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setNeighborhood("all");
              }}
            >
              <option value="all">{txt.all}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="dashboard-estrato-filter">
              {txt.estrato}
            </label>
            <select
              id="dashboard-estrato-filter"
              className="mt-1 rounded-xl border border-slate-200 bg-elevated px-3 py-2.5 text-sm shadow-sm"
              value={estrato}
              onChange={(e) => setEstrato(e.target.value)}
            >
              <option value="all">{txt.all}</option>
              {estratos.map((e) => (
                <option key={e} value={String(e)}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="dashboard-neighborhood-filter">
              {txt.neighborhood}
            </label>
            <select
              id="dashboard-neighborhood-filter"
              className="mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-elevated px-3 py-2.5 text-sm shadow-sm"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            >
              <option value="all">{txt.all}</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-hover"
            onClick={() => void load()}
          >
            {txt.refresh}
          </button>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-elevated shadow-card">
          <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3 text-sm font-semibold text-slate-800">
            {txt.whatChangedThisMonth}
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{txt.momMedianM2}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {monthlyNarrative?.momPct != null
                  ? `${monthlyNarrative.momPct >= 0 ? "+" : ""}${monthlyNarrative.momPct.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{txt.trend3m}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {monthlyNarrative?.trend3mPct != null
                  ? `${monthlyNarrative.trend3mPct >= 0 ? "+" : ""}${monthlyNarrative.trend3mPct.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{txt.currentMonthSample}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {monthlyNarrative?.current.sample ?? 0}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-elevated shadow-card">
          <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">{txt.monthlyMonitoring}</p>
            <p className="mt-0.5 text-xs text-muted">{txt.monthlyMedianChart}</p>
          </div>
          <MonthlyTrendChart
            rows={qualifiedMonthlyStats}
            locale={locale}
            noDataLabel={txt.monthlyChartNoData}
            tooltipLabel={txt.monthlyMedianTooltipLabel}
          />
          <div className="hidden overflow-x-auto border-t border-slate-100 md:block">
            <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
              <thead className="sticky top-0 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.month}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.sample}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.medianPriceM2}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">P25-P75</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.quality}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyStats.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={5}>
                      {txt.noDataForFilters}
                    </td>
                  </tr>
                ) : monthlyStats.map((r) => (
                  <tr key={r.month} className="odd:bg-slate-50/40 hover:bg-surface/50">
                    <td className="px-4 py-3 tabular-nums">{r.month}</td>
                    <td className="px-4 py-3 tabular-nums">{r.sample}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(r.medianPpm2, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.p25 != null && r.p75 != null ? `${fmtCop(r.p25, locale)} - ${fmtCop(r.p75, locale)}` : "—"}
                    </td>
                    <td className="px-4 py-3">{r.minSampleMet ? txt.pass : txt.lowSample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 border-t border-slate-100 p-4 md:hidden">
            {monthlyStats.length === 0 ? (
              <p className="text-sm text-slate-500">{txt.noDataForFilters}</p>
            ) : (
              monthlyStats.map((r) => (
                <article key={r.month} className="rounded-xl border border-slate-200 bg-surface p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{txt.month}</p>
                  <p className="text-sm font-semibold text-slate-800">{r.month}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-muted">{txt.sample}: </span>
                      {r.sample}
                    </p>
                    <p>
                      <span className="text-muted">{txt.quality}: </span>
                      {r.minSampleMet ? txt.pass : txt.lowSample}
                    </p>
                    <p>
                      <span className="text-muted">{txt.medianPriceM2}: </span>
                      {fmtCop(r.medianPpm2, locale)}
                    </p>
                    <p>
                      <span className="text-muted">P25-P75: </span>
                      {r.p25 != null && r.p75 != null ? `${fmtCop(r.p25, locale)} - ${fmtCop(r.p75, locale)}` : "—"}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <CollapsibleSection title={txt.propertyTypeComparison} className="mb-8">
        <section className="overflow-hidden surface-panel">
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
              <thead className="sticky top-0 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.type}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.count}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">P25</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.median}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">P75</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.medianArea}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {typeStats.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={6}>
                      {txt.noDataForFilters} {txt.adjustFiltersHint}
                    </td>
                  </tr>
                ) : typeStats.map((r) => (
                  <tr key={r.type ?? NULL_TYPE} className="odd:bg-slate-50/40">
                    <td className="px-4 py-3">{r.type ?? txt.unknown}</td>
                    <td className="px-4 py-3 tabular-nums">{r.count}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(r.p25, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(r.medianPpm2, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(r.p75, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.medianArea != null ? `${r.medianArea.toFixed(1)} m²` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {typeStats.length === 0 ? (
              <p className="text-sm text-slate-500">
                {txt.noDataForFilters} {txt.adjustFiltersHint}
              </p>
            ) : (
              typeStats.map((r) => (
                <article key={r.type ?? NULL_TYPE} className="rounded-xl border border-slate-200 bg-surface p-3">
                  <p className="text-sm font-semibold text-slate-800">{r.type ?? txt.unknown}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-muted">{txt.count}: </span>
                      {r.count}
                    </p>
                    <p>
                      <span className="text-muted">{txt.medianArea}: </span>
                      {r.medianArea != null ? `${r.medianArea.toFixed(1)} m²` : "—"}
                    </p>
                    <p>
                      <span className="text-muted">P25: </span>
                      {fmtCop(r.p25, locale)}
                    </p>
                    <p>
                      <span className="text-muted">{txt.median}: </span>
                      {fmtCop(r.medianPpm2, locale)}
                    </p>
                    <p className="col-span-2">
                      <span className="text-muted">P75: </span>
                      {fmtCop(r.p75, locale)}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        </CollapsibleSection>

        <CollapsibleSection title={txt.neighborhoodTransparency} className="mb-8">
        <section className="overflow-hidden surface-panel">
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
              <thead className="sticky top-0 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.neighborhood}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.count}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.sampleCheck}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.medianPriceM2}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.deltaVsCity}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">IQR (P25-P75)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {neighborhoodStats.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={6}>
                      {txt.noDataForFilters} {txt.adjustFiltersHint}
                    </td>
                  </tr>
                ) : neighborhoodStats.map((r) => (
                  <tr key={r.name ?? "__unknown_nb"} className="odd:bg-slate-50/40">
                    <td className="px-4 py-3">{r.name ?? txt.unknown}</td>
                    <td className="px-4 py-3 tabular-nums">{r.count}</td>
                    <td className="px-4 py-3">{r.minSampleMet ? `${txt.pass} (${r.sampleSize})` : `${txt.lowSample} (${r.sampleSize})`}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtCop(r.medianPpm2, locale)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.deltaPct == null
                        ? "—"
                        : `${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.p25 != null && r.p75 != null
                        ? `${Math.round(r.p25).toLocaleString(locale)} - ${Math.round(r.p75).toLocaleString(locale)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {neighborhoodStats.length === 0 ? (
              <p className="text-sm text-slate-500">
                {txt.noDataForFilters} {txt.adjustFiltersHint}
              </p>
            ) : (
              neighborhoodStats.map((r) => (
                <article key={r.name ?? "__unknown_nb"} className="rounded-xl border border-slate-200 bg-surface p-3">
                  <p className="text-sm font-semibold text-slate-800">{r.name ?? txt.unknown}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-muted">{txt.count}: </span>
                      {r.count}
                    </p>
                    <p>
                      <span className="text-muted">{txt.sampleCheck}: </span>
                      {r.minSampleMet ? `${txt.pass} (${r.sampleSize})` : `${txt.lowSample} (${r.sampleSize})`}
                    </p>
                    <p>
                      <span className="text-muted">{txt.medianPriceM2}: </span>
                      {fmtCop(r.medianPpm2, locale)}
                    </p>
                    <p>
                      <span className="text-muted">{txt.deltaVsCity}: </span>
                      {r.deltaPct == null ? "—" : `${r.deltaPct >= 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%`}
                    </p>
                    <p className="col-span-2">
                      <span className="text-muted">IQR (P25-P75): </span>
                      {r.p25 != null && r.p75 != null
                        ? `${Math.round(r.p25).toLocaleString(locale)} - ${Math.round(r.p75).toLocaleString(locale)}`
                        : "—"}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        </CollapsibleSection>

        <section className="mb-8 surface-panel overflow-hidden">
          <div className="section-table-head text-sm font-semibold text-foreground">
            {txt.pricingIntelligence}
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{txt.cityBaselineMedian}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{fmtCop(pricingIntelligence?.cityMedian, locale)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{txt.expectedFairValue}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{fmtCop(pricingIntelligence?.expectedPpm2, locale)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {txt.band}: {fmtCop(pricingIntelligence?.lowBand, locale)} - {fmtCop(pricingIntelligence?.highBand, locale)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{txt.topModelDrivers}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {(pricingIntelligence?.drivers ?? []).map((d) => (
                  <li key={`${d.label}-${d.name ?? "?"}`}>
                    {d.label}: {d.name ?? txt.unknown} ({d.impactPct >= 0 ? "+" : ""}
                    {d.impactPct.toFixed(1)}%, n={d.sample})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-elevated shadow-card">
          <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3 text-sm font-semibold text-slate-800">
            {txt.investmentReadiness}
          </div>
          <div className="p-4 text-sm text-slate-700">
            <p className="mb-3">
              {txt.status}: <span className="font-semibold">{investmentGate.ready ? txt.readyToEnable : txt.hold}</span>
            </p>
            <p>- {txt.monthlyHistory} (&gt;=4 months): {investmentGate.enoughMonthlyHistory ? txt.pass : txt.pending}</p>
            <p>- Price/m² coverage (&gt;=60%): {investmentGate.enoughCoverage ? txt.pass : txt.pending}</p>
            <p>- KPI sample size (&gt;= {MIN_SAMPLE_SIZE}): {investmentGate.enoughSample ? txt.pass : txt.pending}</p>
          </div>
        </section>

        <CollapsibleSection title={txt.estratoTypeMatrix} className="mb-8">
        <section className="overflow-hidden surface-panel">
          <div className="overflow-x-auto">
            <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
              <thead className="sticky top-0 bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">Estrato</th>
                  {estratoTypeMatrix.types.map((t) => (
                    <th key={t} className="px-4 py-3 font-medium text-slate-700">
                      {matrixTypeLabel(t, txt.unknown)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estratoTypeMatrix.rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={Math.max(1, estratoTypeMatrix.types.length + 1)}>
                      {txt.noDataForFilters}
                    </td>
                  </tr>
                ) : estratoTypeMatrix.rows.map((r) => (
                  <tr key={r.estrato} className="odd:bg-slate-50/40">
                    <td className="px-4 py-3 tabular-nums">{r.estrato}</td>
                    {r.cells.map((c) => (
                      <td
                        key={`${r.estrato}-${c.type}`}
                        className="px-4 py-3 tabular-nums"
                      >
                        {c.count > 0
                          ? `${fmtCop(c.medianPpm2, locale)} (${c.count})`
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </CollapsibleSection>

        <EmailSignupForm
          lang={lang}
          source="dashboard"
          defaultCity={city !== "all" ? city : DEFAULT_ZONE_CITY}
          defaultLists={["market_monthly_city", "deals_city"]}
          visibleLists={["market_monthly_city", "market_quarterly_colombia", "deals_city", "price_drops_city"]}
          collapsedByDefault
          className="mb-8"
        />
      </main>
      <PageFooter />
    </div>
  );
}
