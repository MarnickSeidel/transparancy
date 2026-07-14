"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import EmailSignupForm from "@/app/components/EmailSignupForm";
import PageFooter from "@/app/components/PageFooter";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection";
import SiteHeader from "@/app/components/SiteHeader";
import Card from "@/app/components/ui/Card";
import Skeleton from "@/app/components/ui/Skeleton";
import Button from "@/app/components/ui/Button";
import { buildFincaRaizSearchUrl } from "@/lib/fincaraizSearch";
import { formatFreshnessDate } from "@/lib/getDataFreshness";
import {
  DEFAULT_MIN_ZONE_DATA_POINTS,
  isApartmentType,
  isHouseType,
  type PublishableZone,
  type ZoneConfidence,
  type ZoneDossier,
} from "@/lib/zones";
import { localePath, opportunitiesPath, type Locale } from "@/lib/locale";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

const MonthlyTrendChart = dynamic(() => import("@/app/components/MonthlyTrendChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full rounded-2xl" />,
});

type Props = {
  citySlug: string;
  zoneSlug: string;
  locale?: Locale;
  /** Server-rendered dossier — skips initial client fetch when set. */
  initialData?: ZoneDossier | null;
  introParagraphs?: string[];
  breadcrumbItems?: Array<{ label: string; href: string }>;
  relatedZones?: PublishableZone[];
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

export default function ZoneDossier({
  citySlug,
  zoneSlug,
  locale: pageLocale = "es",
  initialData,
  introParagraphs = [],
  breadcrumbItems = [],
  relatedZones = [],
}: Props) {
  const { lang, toggleLang } = useUiLang(pageLocale);
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";
  const lp = (path: string) => localePath(lang, path);

  const [data, setData] = useState<ZoneDossier | null>(initialData ?? null);
  const [loading, setLoading] = useState(initialData == null);
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
      setData((await res.json()) as ZoneDossier);
    } catch {
      setError(txt.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [citySlug, zoneSlug, txt.couldNotLoad]);

  useEffect(() => {
    if (initialData != null) return;
    void load();
  }, [load, initialData]);

  const exploreHref = useMemo(() => {
    if (!data) return "/explore";
    const p = new URLSearchParams();
    p.set("city", data.city);
    p.set("neighborhood", data.exploreNeighborhood);
    return `/explore?${p.toString()}`;
  }, [data]);

  const opportunitiesHref = useMemo(() => {
    if (!data) return opportunitiesPath(lang);
    const p = new URLSearchParams();
    p.set("city", data.city);
    p.set("neighborhood", data.exploreNeighborhood);
    return opportunitiesPath(lang, p.toString());
  }, [data, lang]);

  const fincaRaizHref = useMemo(() => {
    if (!data) return null;
    return buildFincaRaizSearchUrl(data.city, data.exploreNeighborhood);
  }, [data]);

  const analyzeHref = useMemo(() => {
    if (!data) return "/analyze-url";
    const p = new URLSearchParams();
    p.set("city", data.city);
    if (data.exploreNeighborhood) p.set("neighborhood", data.exploreNeighborhood);
    return `/analyze-url?${p.toString()}`;
  }, [data]);

  const estimateHref = useMemo(() => {
    if (!data) return "/estimate";
    const p = new URLSearchParams();
    p.set("city", data.city);
    if (data.exploreNeighborhood) p.set("neighborhood", data.exploreNeighborhood);
    return `/estimate?${p.toString()}`;
  }, [data]);

  const lastUpdatedLabel = useMemo(() => {
    if (!data?.lastUpdatedAt) return null;
    return formatFreshnessDate(new Date(data.lastUpdatedAt), locale);
  }, [data?.lastUpdatedAt, locale]);

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
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {breadcrumbItems.length > 0 ? (
          <Breadcrumbs items={breadcrumbItems} />
        ) : (
          <p className="mb-6">
            <Link href={lp("/zones")} className="text-sm font-medium text-accent hover:underline">
              {txt.zonesBackToList}
            </Link>
          </p>
        )}

        {introParagraphs.length > 0 ? (
          <div className="mb-8 max-w-3xl space-y-3 text-sm leading-relaxed text-muted">
            {introParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-900"
            >
              {txt.refresh}
            </button>
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
              {lastUpdatedLabel ? (
                <span className="text-xs text-muted">
                  {txt.dataFreshnessLabel}: {lastUpdatedLabel}
                </span>
              ) : null}
              {data.opportunityCount > 0 ? (
                <Link
                  href={opportunitiesHref}
                  className="text-sm font-semibold text-accent hover:underline"
                >
                  {fmtTemplate(txt.zonesDealsInBarrio, { n: data.opportunityCount })} · {txt.zonesDealsLink}
                </Link>
              ) : null}
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card tier="inline">
                <p className="text-meta">{txt.zonesActiveListings}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {data.listingCount.toLocaleString(locale)}
                </p>
              </Card>
              <Card tier="inline">
                <p className="text-meta">{txt.zonesDataPoints}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {data.dataPointCount.toLocaleString(locale)}
                </p>
              </Card>
              <Card tier="hero">
                <p className="text-section-label">{txt.zonesMedianPpm2}</p>
                <p className="text-data-hero mt-2 text-3xl md:text-3xl">
                  {fmtCop(data.medianPricePerM2, locale)}
                </p>
              </Card>
              <Card tier="inline">
                <p className="text-meta">{txt.zonesMedianPrice}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {fmtCop(data.medianPriceCop, locale)}
                </p>
              </Card>
            </div>

            {data.geoListingCount >= 3 &&
            data.centroidLatitude != null &&
            data.centroidLongitude != null ? (
              <div className="mb-6">
                <p className="mb-2 text-xs text-muted">{txt.nearbyAmenitiesZoneSubtitle}</p>
                <NearbyAmenitiesSection
                  latitude={data.centroidLatitude}
                  longitude={data.centroidLongitude}
                  lang={lang}
                  locale={locale}
                />
              </div>
            ) : null}

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
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-muted dark:border-slate-700">
                        <th className="pb-2 pr-4">{lang === "en" ? "Month" : "Mes"}</th>
                        <th className="pb-2 pr-4">{lang === "en" ? "Sample" : "Muestra"}</th>
                        <th className="pb-2">{txt.zonesMedianPpm2}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartRows.map((row) => (
                        <tr
                          key={row.month}
                          className="border-b border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 font-medium text-foreground">{row.month}</td>
                          <td className="py-2 pr-4 tabular-nums text-muted">
                            {row.sample.toLocaleString(locale)}
                          </td>
                          <td className="py-2 tabular-nums text-accent">
                            {fmtCop(row.medianPpm2, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <MonthlyTrendChart
                  rows={chartRows}
                  locale={locale}
                  noDataLabel={txt.monthlyChartNoData}
                  tooltipLabel={txt.monthlyMedianTooltipLabel}
                />
              </Card>
            ) : null}

            {relatedZones.length > 0 ? (
              <Card className="mb-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {lang === "en" ? "Related neighborhoods" : "Barrios relacionados"}
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {relatedZones.map((z) => (
                    <li key={z.slug}>
                      <Link
                        href={lp(`/zones/${z.citySlug}/${z.slug}`)}
                        className="inline-flex rounded-full border border-slate-200/90 bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-teal-300 dark:border-slate-700/80"
                      >
                        {z.displayName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <p className="mb-6 text-xs text-muted">{txt.dataFreshnessNote}</p>

            <EmailSignupForm
              lang={lang}
              source="zone_dossier"
              title={txt.estimateSubscribeTitle}
              hint={fmtTemplate(txt.estimateSubscribeHint, { city: data.city })}
              defaultCity={data.city}
              defaultNeighborhood={data.displayName}
              defaultLists={["deals_neighborhood", "market_monthly_city"]}
              visibleLists={["deals_neighborhood", "deals_city", "market_monthly_city"]}
              collapsedByDefault
              className="mb-6"
            />

            <Card className="mb-6 border-accent/30 bg-accent/5 shadow-card">
              <h2 className="text-base font-semibold text-foreground">
                {fmtTemplate(txt.zonesAnalyzeCtaTitle, { barrio: data.displayName })}
              </h2>
              <p className="mt-2 text-sm text-muted">{txt.zonesAnalyzeCtaBody}</p>
              <Button href={analyzeHref} className="mt-4">
                {txt.zonesAnalyzeCtaButton}
              </Button>
            </Card>

            <Card className="mb-6 border-teal-200/80 bg-teal-50/40 shadow-card dark:border-teal-900/60 dark:bg-teal-950/20">
              <h2 className="text-base font-semibold text-foreground">
                {fmtTemplate(txt.zonesEstimateCtaTitle, { barrio: data.displayName })}
              </h2>
              <p className="mt-2 text-sm text-muted">{txt.zonesEstimateCtaBody}</p>
              <Button href={estimateHref} className="mt-4">
                {txt.zonesEstimateCtaButton}
              </Button>
            </Card>

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
