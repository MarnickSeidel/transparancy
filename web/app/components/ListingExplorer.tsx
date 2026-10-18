"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import ToolNextSteps from "@/app/components/ToolNextSteps";
import DomBadge from "@/app/components/DomBadge";
import SiteHeader from "@/app/components/SiteHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import SearchableSelect from "@/app/components/ui/SearchableSelect";
import Skeleton from "@/app/components/ui/Skeleton";
import { fetchJsonCached } from "@/lib/clientFetchCache";
import type { FiltersData } from "@/lib/getFiltersData";
import { BUCKET_COLORS, type PriceBucket } from "@/lib/mapPriceBuckets";
import { cityDisplayName } from "@/lib/cityNames";
import { uiText } from "@/lib/i18n";
import { opportunitiesPath, localePath } from "@/lib/locale";
import { propertyTypeLabel, propertyTypeOptions } from "@/lib/propertyTypes";
import { formatDomDays } from "@/lib/formatDom";
import { resolveNeighborhoodLabel } from "@/lib/neighborhoods";
import { buildListingContextLinks } from "@/lib/listingContextLinks";
import { useUiLang } from "@/lib/useUiLang";

type ListingRow = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  neighborhoodRaw: string | null;
  propertyType: string | null;
  estrato: number | null;
  priceCop: string;
  areaM2: number;
  pricePerM2: number | null;
  dealScore: number | null;
  url: string;
  priceBucket: PriceBucket | null;
  deltaVsRefPct: number | null;
  domDays: number | null;
};

type ListingsResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  listings: ListingRow[];
};

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—";
  return `$ ${Math.round(v).toLocaleString(locale)}`;
}

function fmtTemplate(
  template: string,
  vars: Record<string, string | number>,
) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function initialParam(name: string): string {
  if (typeof window === "undefined") return "all";
  const v = new URLSearchParams(window.location.search).get(name)?.trim();
  return v && v.length > 0 ? v : "all";
}

type SimilarFilters = {
  minAreaM2: string;
  maxAreaM2: string;
  minPriceCop: string;
  maxPriceCop: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  conjunto: string;
};

function initialSimilarFilters(): SimilarFilters | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  if (p.get("similar") !== "1") return null;
  return {
    minAreaM2: p.get("minAreaM2") ?? "",
    maxAreaM2: p.get("maxAreaM2") ?? "",
    minPriceCop: p.get("minPriceCop") ?? "",
    maxPriceCop: p.get("maxPriceCop") ?? "",
    latitude: p.get("latitude") ?? "",
    longitude: p.get("longitude") ?? "",
    radiusMeters: p.get("radiusMeters") ?? "",
    conjunto: p.get("conjunto") ?? "",
  };
}

function initialSortBy(): "date" | "price" | "pricePerM2" | "area" | "dealScore" {
  if (typeof window === "undefined") return "date";
  const v = new URLSearchParams(window.location.search).get("sortBy")?.trim();
  if (v === "price" || v === "pricePerM2" || v === "area" || v === "dealScore") return v;
  return "date";
}

function signalMeta(
  bucket: PriceBucket | null,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  switch (bucket) {
    case 0:
      return { label: txt.exploreSignalBelow, colors: BUCKET_COLORS[0] };
    case 1:
      return { label: txt.exploreSignalNearLow, colors: BUCKET_COLORS[1] };
    case 2:
      return { label: txt.exploreSignalAbove, colors: BUCKET_COLORS[2] };
    case 3:
      return { label: txt.exploreSignalHigh, colors: BUCKET_COLORS[3] };
    default:
      return { label: "—", colors: { fill: "#94a3b8", stroke: "#64748b" } };
  }
}

function NeighborhoodCell({
  neighborhood,
  neighborhoodRaw,
  txt,
}: {
  neighborhood: string | null;
  neighborhoodRaw: string | null;
  txt: (typeof uiText)["es"] | (typeof uiText)["en"];
}) {
  const label = neighborhood ?? txt.unknown;
  const raw = neighborhoodRaw?.trim();
  const showTooltip =
    raw &&
    raw.toLowerCase() !== (neighborhood ?? "").trim().toLowerCase();

  if (!showTooltip) {
    return <>{label}</>;
  }

  return (
    <span className="group relative inline-flex cursor-help items-center gap-1">
      {label}
      <span
        className="rounded bg-surface px-1 text-[10px] font-medium text-muted ring-1 ring-slate-200 dark:ring-slate-700"
        title={`${txt.exploreNeighborhoodRawTooltip}: ${raw}`}
        aria-label={`${txt.exploreNeighborhoodRaw}: ${raw}`}
      >
        FR
      </span>
    </span>
  );
}

export default function ListingExplorer({
  initialFilters,
}: {
  initialFilters?: FiltersData;
}) {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [cities, setCities] = useState<string[]>(initialFilters?.cities ?? []);
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    initialFilters?.neighborhoods ?? [],
  );
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    initialFilters?.propertyTypes ?? [],
  );
  const [estratos, setEstratos] = useState<number[]>(initialFilters?.estratos ?? []);

  const [city, setCity] = useState(() => initialParam("city"));
  const [neighborhood, setNeighborhood] = useState(() => initialParam("neighborhood"));
  const [propertyType, setPropertyType] = useState(() => initialParam("propertyType"));
  const [estrato, setEstrato] = useState(() => initialParam("estrato"));
  const [maxPriceCop, setMaxPriceCop] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("maxPriceCop")?.trim() ?? "";
  });
  const [similarFilters, setSimilarFilters] = useState<SimilarFilters | null>(
    () => initialSimilarFilters(),
  );
  const [sortBy, setSortBy] = useState<"date" | "price" | "pricePerM2" | "area" | "dealScore">(
    () => initialSortBy(),
  );
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ListingsResponse | null>(null);
  const [dossierHref, setDossierHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (city !== "all") p.set("city", city);
    if (neighborhood !== "all" && neighborhood.trim()) p.set("neighborhood", neighborhood.trim());
    if (propertyType !== "all" && propertyType.trim()) p.set("propertyType", propertyType.trim());
    if (estrato !== "all") p.set("estrato", estrato);
    const maxDigits = maxPriceCop.replace(/\D/g, "");
    const maxParsed = maxDigits ? Number.parseInt(maxDigits, 10) : Number.NaN;
    if (Number.isFinite(maxParsed) && maxParsed >= 1) p.set("maxPriceCop", String(maxParsed));
    if (similarFilters) {
      p.set("similar", "1");
      if (similarFilters.minAreaM2) p.set("minAreaM2", similarFilters.minAreaM2);
      if (similarFilters.maxAreaM2) p.set("maxAreaM2", similarFilters.maxAreaM2);
      if (similarFilters.minPriceCop) p.set("minPriceCop", similarFilters.minPriceCop);
      if (similarFilters.maxPriceCop && !maxPriceCop.trim()) {
        p.set("maxPriceCop", similarFilters.maxPriceCop);
      }
      if (similarFilters.latitude) p.set("latitude", similarFilters.latitude);
      if (similarFilters.longitude) p.set("longitude", similarFilters.longitude);
      if (similarFilters.radiusMeters) p.set("radiusMeters", similarFilters.radiusMeters);
      if (similarFilters.conjunto) p.set("conjunto", similarFilters.conjunto);
    }
    if (sortBy !== "date") p.set("sortBy", sortBy);
    p.set("page", String(page));
    return p.toString();
  }, [city, estrato, maxPriceCop, neighborhood, page, propertyType, similarFilters, sortBy]);

  const nextSteps = useMemo(() => {
    const ctxCity = city !== "all" ? city : null
    if (!ctxCity) {
      return [
        {
          title: txt.nextStepsAnalyzeTitle,
          description: txt.nextStepsAnalyzeDesc,
          href: localePath(lang, "/analyze-url"),
          cta: txt.analyzeUrlNav,
        },
        {
          title: txt.nextStepsOpportunitiesTitle,
          description: txt.nextStepsOpportunitiesDesc,
          href: opportunitiesPath(lang),
          cta: txt.opportunitiesNav,
        },
        {
          title: txt.nextStepsZonesTitle,
          description: txt.nextStepsZonesDesc,
          href: localePath(lang, "/zones"),
          cta: txt.zonesNav,
        },
      ]
    }
    const links = buildListingContextLinks({
      lang,
      city: ctxCity,
      neighborhood: neighborhood !== "all" ? neighborhood : null,
      propertyType: propertyType !== "all" ? propertyType : null,
      estrato: estrato !== "all" ? Number.parseInt(estrato, 10) : null,
    })
    return [
      {
        title: txt.nextStepsAnalyzeTitle,
        description: txt.nextStepsAnalyzeDesc,
        href: links.analyzeHref,
        cta: txt.analyzeUrlNav,
      },
      {
        title: txt.nextStepsOpportunitiesTitle,
        description: txt.nextStepsOpportunitiesDesc,
        href: links.opportunitiesHref,
        cta: txt.opportunitiesNav,
      },
      {
        title: txt.nextStepsHeatmapTitle,
        description: txt.nextStepsHeatmapDesc,
        href: links.heatmapHref,
        cta: txt.heatmapNav,
      },
    ]
  }, [city, estrato, lang, neighborhood, propertyType, txt])

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (city !== "all") {
      chips.push({ key: "city", label: `${txt.city}: ${cityDisplayName(city)}`, onClear: () => { setCity("all"); setNeighborhood("all"); } });
    }
    if (neighborhood !== "all") {
      chips.push({ key: "neighborhood", label: `${txt.neighborhood}: ${neighborhood}`, onClear: () => setNeighborhood("all") });
    }
    if (propertyType !== "all") {
      chips.push({ key: "type", label: `${txt.type}: ${propertyType}`, onClear: () => setPropertyType("all") });
    }
    if (estrato !== "all") {
      chips.push({ key: "estrato", label: `${txt.estrato}: ${estrato}`, onClear: () => setEstrato("all") });
    }
    const maxDigits = maxPriceCop.replace(/\D/g, "");
    const maxParsed = maxDigits ? Number.parseInt(maxDigits, 10) : Number.NaN;
    if (Number.isFinite(maxParsed) && maxParsed >= 1) {
      chips.push({
        key: "maxPrice",
        label: `${txt.opportunitiesMaxPrice}: ${fmtCop(maxParsed, locale)}`,
        onClear: () => setMaxPriceCop(""),
      });
    }
    return chips;
  }, [city, estrato, locale, maxPriceCop, neighborhood, propertyType, txt]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!data) setLoading(true);
    setError(null);
    try {
      const filtersUrl = `/api/filters${city !== "all" ? `?city=${encodeURIComponent(city)}` : ""}`;
      const [fJson, lJson] = await Promise.all([
        fetchJsonCached<{
          cities?: string[];
          neighborhoods?: string[];
          propertyTypes?: string[];
          estratos?: number[];
        }>(filtersUrl),
        fetch(`/api/listings?${queryString}`, { signal }).then(async (res) => {
          if (!res.ok) throw new Error("load");
          return (await res.json()) as ListingsResponse;
        }),
      ]);
      if (signal?.aborted) return;
      const nextNeighborhoods: string[] = fJson.neighborhoods ?? [];
      setCities(fJson.cities ?? []);
      setNeighborhoods(nextNeighborhoods);
      setPropertyTypes(fJson.propertyTypes ?? []);
      setEstratos(fJson.estratos ?? []);
      setNeighborhood((prev) =>
        prev === "all" ? prev : resolveNeighborhoodLabel(prev, nextNeighborhoods),
      );
      setData(lJson);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(txt.couldNotLoad);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [city, queryString, txt.couldNotLoad, data]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [city, neighborhood, propertyType, estrato, maxPriceCop, sortBy]);

  useEffect(() => {
    if (city === "all" || neighborhood === "all" || !neighborhood.trim()) {
      setDossierHref(null);
      return;
    }
    const p = new URLSearchParams({ city, neighborhood: neighborhood.trim() });
    void fetch(`/api/zones/resolve?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { published?: boolean; href?: string | null } | null) => {
        setDossierHref(json?.published && json.href ? json.href : null);
      })
      .catch(() => setDossierHref(null));
  }, [city, neighborhood]);

  const neighborhoodOptions = useMemo(
    () => (city === "all" ? [] : neighborhoods.map((n) => ({ value: n, label: n }))),
    [city, neighborhoods],
  );

  const rows = data?.listings ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const clearAllFilters = () => {
    setCity("all");
    setNeighborhood("all");
    setPropertyType("all");
    setEstrato("all");
    setMaxPriceCop("");
    setSimilarFilters(null);
    setSortBy("date");
  };

  const clearSimilarFilters = () => {
    setSimilarFilters(null);
    setMaxPriceCop("");
    setSortBy("date");
  };

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.exploreTitle}
        subtitle={txt.explorePurpose}
        active="explore"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
            {error}
          </div>
        ) : null}

        {similarFilters ? (
          <Card className="mb-6 border-accent/30 bg-accent/5 p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{txt.exploreSimilarBannerTitle}</p>
                <p className="mt-1 text-sm text-muted">{txt.exploreSimilarBannerBody}</p>
              </div>
              <button
                type="button"
                onClick={clearSimilarFilters}
                className="shrink-0 rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface dark:border-slate-700/80"
              >
                {txt.exploreSimilarClear}
              </button>
            </div>
          </Card>
        ) : null}

        <p className="mb-6 flex flex-wrap items-center gap-4">
          <Link href="/zones" className="text-sm font-medium text-accent hover:underline">
            {txt.zonesLink}
          </Link>
          {dossierHref ? (
            <Link href={dossierHref} className="text-sm font-medium text-accent hover:underline">
              {txt.viewBarrioDossier}
            </Link>
          ) : null}
        </p>

        <Card className="mb-6 border-border-subtle p-4 shadow-card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {txt.opportunitiesPrimaryFilters}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-city">
                {txt.city}
              </label>
              <select
                id="exp-city"
                className={`${inputClassName} sm:min-w-[180px]`}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setNeighborhood("all");
                }}
              >
                <option value="all">{txt.allCities}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {cityDisplayName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-type">
                {txt.type}
              </label>
              <select
                id="exp-type"
                className={`${inputClassName} sm:min-w-[170px]`}
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
              >
                <option value="all">{txt.all}</option>
                {propertyTypeOptions(propertyTypes, lang).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-neighborhood">
                {txt.neighborhood}
              </label>
              <SearchableSelect
                id="exp-neighborhood"
                className="sm:min-w-[220px]"
                allowEmpty
                emptyLabel={txt.all}
                disabled={city === "all"}
                value={neighborhood === "all" ? "" : neighborhood}
                options={neighborhoodOptions}
                filterMode="auto"
                placeholder={
                  city === "all" ? txt.exploreSelectCityFirst : txt.searchableSelectPlaceholder
                }
                noResultsLabel={txt.searchableSelectNoMatch}
                openListLabel={txt.searchableSelectOpenList}
                closeListLabel={txt.searchableSelectCloseList}
                aria-label={txt.neighborhood}
                onChange={(next) => setNeighborhood(next || "all")}
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-estrato">
                {txt.estrato}
              </label>
              <select
                id="exp-estrato"
                className={`${inputClassName} sm:min-w-[120px]`}
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
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted">
                {txt.opportunitiesMaxPrice}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className={`${inputClassName} sm:min-w-[180px]`}
                value={maxPriceCop}
                onChange={(e) => setMaxPriceCop(e.target.value)}
                placeholder={txt.opportunitiesMaxPricePlaceholder}
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-sort">
                {txt.exploreSortBy}
              </label>
              <select
                id="exp-sort"
                className={`${inputClassName} sm:min-w-[170px]`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="date">{txt.exploreSortDate}</option>
                <option value="price">{txt.exploreSortPrice}</option>
                <option value="pricePerM2">{txt.exploreSortPpm2}</option>
                <option value="dealScore">{txt.exploreSortDealScore}</option>
                <option value="area">{txt.exploreSortArea}</option>
              </select>
            </div>
            <Button onClick={() => void load()} disabled={loading}>
              {loading ? "…" : txt.refresh}
            </Button>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {txt.exploreFilterChips}
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-accent hover:underline"
                  onClick={clearAllFilters}
                >
                  {txt.exploreClearFilters}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-3 py-1 text-sm text-foreground dark:border-slate-700"
                  >
                    {chip.label}
                    <button
                      type="button"
                      className="rounded-full px-1 text-muted hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-700"
                      aria-label={txt.exploreClearFilters}
                      onClick={chip.onClear}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="overflow-hidden border-border-subtle shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {txt.exploreResults}
              </p>
              <p className="text-xs text-muted">
                {fmtTemplate(txt.exploreShowing, { from, to, total })}
              </p>
            </div>
            <p className="text-xs text-muted">
              {fmtTemplate(txt.explorePage, { page, pages: totalPages })}
            </p>
          </div>

          {loading ? (
            <div className="space-y-2 px-4 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">{txt.exploreEmpty}</div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">{txt.explorePriceSignal}</th>
                    <th scope="col" className="px-4 py-3">{txt.type}</th>
                    <th scope="col" className="px-4 py-3">{txt.cityLabel}</th>
                    <th scope="col" className="px-4 py-3">{txt.neighborhood}</th>
                    <th scope="col" className="px-4 py-3">{txt.medianPriceM2}</th>
                    <th scope="col" className="px-4 py-3">{txt.exploreSortPrice}</th>
                    <th scope="col" className="px-4 py-3">{txt.dealScore}</th>
                    <th scope="col" className="px-4 py-3">{txt.exploreSortArea}</th>
                    <th scope="col" className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const signal = signalMeta(row.priceBucket, txt);
                    const delta =
                      row.deltaVsRefPct != null && Number.isFinite(row.deltaVsRefPct)
                        ? `${row.deltaVsRefPct >= 0 ? "+" : ""}${row.deltaVsRefPct.toFixed(1)}%`
                        : "—";
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: `${signal.colors.fill}22`,
                              color: signal.colors.stroke,
                            }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: signal.colors.fill }}
                            />
                            {signal.label}
                          </span>
                          <p className="mt-1 text-[11px] text-muted">
                            {txt.exploreDeltaVsRef}: {delta}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {row.propertyType ?? txt.unknown}
                          </p>
                          <p className="mt-1 max-w-xs truncate text-xs text-muted">{row.title}</p>
                          {row.domDays != null ? (
                            <DomBadge
                              days={row.domDays}
                              lang={lang}
                              label={formatDomDays(row.domDays, lang) ?? ""}
                              className="mt-2"
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{cityDisplayName(row.city)}</td>
                        <td className="px-4 py-3">
                          <NeighborhoodCell
                            neighborhood={row.neighborhood}
                            neighborhoodRaw={row.neighborhoodRaw}
                            txt={txt}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtCop(row.pricePerM2, locale)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtCop(Number(row.priceCop), locale)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {row.dealScore?.toFixed(1) ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.areaM2.toLocaleString(locale)} m²
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            {txt.exploreOpenListing}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {rows.map((row) => {
                const signal = signalMeta(row.priceBucket, txt)
                const delta =
                  row.deltaVsRefPct != null && Number.isFinite(row.deltaVsRefPct)
                    ? `${row.deltaVsRefPct >= 0 ? "+" : ""}${row.deltaVsRefPct.toFixed(1)}%`
                    : "—"
                return (
                  <article
                    key={row.id}
                    className="rounded-xl border border-border-subtle bg-elevated p-4 dark:border-slate-700/80"
                  >
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: `${signal.colors.fill}22`,
                        color: signal.colors.stroke,
                      }}
                    >
                      {signal.label}
                    </span>
                    <p className="mt-2 font-medium text-foreground">
                      {propertyTypeLabel(row.propertyType, lang)}
                    </p>
                    <p className="mt-1 text-xs text-muted">{row.title}</p>
                    {row.domDays != null ? (
                      <DomBadge
                        days={row.domDays}
                        lang={lang}
                        label={formatDomDays(row.domDays, lang) ?? ""}
                        className="mt-2"
                      />
                    ) : null}
                    <p className="mt-2 text-sm text-muted">
                      {cityDisplayName(row.city)} · {row.neighborhood ?? txt.unknown}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted">{txt.price}</p>
                        <p className="font-semibold tabular-nums">{fmtCop(Number(row.priceCop), locale)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">{txt.pricePerM2}</p>
                        <p className="font-semibold tabular-nums">{fmtCop(row.pricePerM2, locale)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {txt.exploreDeltaVsRef}: {delta}
                    </p>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs font-semibold text-accent hover:underline"
                    >
                      {txt.exploreOpenListing}
                    </a>
                  </article>
                )
              })}
            </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
            <Button
              variant="secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {txt.explorePrev}
            </Button>
            <Button
              variant="secondary"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {txt.exploreNext}
            </Button>
          </div>
        </Card>

        <ToolNextSteps title={txt.nextStepsTitle} steps={nextSteps} />
      </main>

      <PageFooter />
    </div>
  );
}
