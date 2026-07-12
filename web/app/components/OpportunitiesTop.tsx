"use client"
import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import CollapsibleSection from "@/app/components/CollapsibleSection";
import OpportunityMobileCard from "@/app/components/OpportunityMobileCard";
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import Skeleton from "@/app/components/ui/Skeleton";
import SiteHeader from "@/app/components/SiteHeader";
import WhyDealPanel from "@/app/components/WhyDealPanel";
import { fetchJsonCached } from "@/lib/clientFetchCache";
import { formatDomDays } from "@/lib/formatDom";
import type { WhyDeal } from "@/lib/dealEngine";
import { uiText } from "@/lib/i18n";
import { propertyTypeOptions } from "@/lib/propertyTypes";
import { useUiLang } from "@/lib/useUiLang";

const PriceTimelineChart = dynamic(() => import("@/app/components/PriceTimelineChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-lg bg-surface" />,
});

type OpportunityRow = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  zoneName?: string | null;
  priceCop: string;
  areaM2: number;
  pricePerM2: number | null;
  metricType?: "private" | "built" | "terrain" | "generic";
  refAvgUsed: number | null;
  compSampleSize?: number;
  compMethod?: string;
  dealScore: number | null;
  whyDeal?: WhyDeal | null;
  discountVsRefPct: number | null;
  confidence?: "high" | "medium" | "low";
  confidenceReasons?: string[];
  priceDropPct?: number | null;
  domDays?: number | null;
  priceTimeline?: Array<{ recordedAt: string; priceCop: string }>;
  acceptsBarter?: boolean;
  isProject?: boolean;
  url: string;
  sourceUpdatedAt: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—";
  return `$ ${Math.round(v).toLocaleString(locale)}`;
}

function confidenceLabel(
  c: OpportunityRow["confidence"] | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (c === "high") return txt.confidenceHigh;
  if (c === "medium") return txt.confidenceMedium;
  if (c === "low") return txt.confidenceLow;
  return "—";
}

function metricTypeLabel(
  t: OpportunityRow["metricType"] | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (t === "private") return txt.opportunitiesMetricPrivate;
  if (t === "built") return txt.opportunitiesMetricBuilt;
  if (t === "terrain") return txt.opportunitiesMetricTerrain;
  return txt.opportunitiesMetricGeneric;
}

function signalTags(
  row: OpportunityRow,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
  lang: "es" | "en",
) {
  const tags: string[] = [];
  if (row.acceptsBarter) tags.push(txt.opportunitiesFlagBarter);
  if (row.isProject) tags.push(txt.opportunitiesFlagProject);
  if (row.priceDropPct != null && row.priceDropPct >= 2) {
    tags.push(txt.opportunitiesFlagPriceDrop.replace("{pct}", row.priceDropPct.toFixed(0)));
  }
  if (row.domDays != null && row.domDays >= 45) {
    tags.push(formatDomDays(row.domDays, lang === "es" ? "es" : "en") ?? "");
  }
  return tags;
}

/** Read ?city=&neighborhood=&propertyType= on first client paint (page is loaded with ssr:false). */
function initialOppParam(name: string): string {
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
  estrato: string;
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
    estrato: p.get("estrato") ?? "",
    conjunto: p.get("conjunto") ?? "",
  };
}

export default function OpportunitiesTop() {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [city, setCity] = useState(() => initialOppParam("city"));
  const [neighborhood, setNeighborhood] = useState(() =>
    initialOppParam("neighborhood"),
  );
  const [propertyType, setPropertyType] = useState(() =>
    initialOppParam("propertyType"),
  );
  const [excludedNeighborhoods, setExcludedNeighborhoods] = useState<string[]>([]);
  const [excludeDraft, setExcludeDraft] = useState("");
  const [maxPriceCop, setMaxPriceCop] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("maxPriceCop")?.trim() ?? "";
  });
  const [similarFilters, setSimilarFilters] = useState<SimilarFilters | null>(
    () => initialSimilarFilters(),
  );
  const [minDiscountPct, setMinDiscountPct] = useState("");
  const [excludeBarter, setExcludeBarter] = useState(false);
  const [excludeProjects, setExcludeProjects] = useState(false);
  const [excludeUnknownNeighborhoods, setExcludeUnknownNeighborhoods] =
    useState(false);
  const [hideLowConfidence, setHideLowConfidence] = useState(true);
  const [sortBy, setSortBy] = useState<"dealScore" | "discount" | "price" | "confidence">("dealScore");
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const excludeSuggestions = useMemo(() => {
    const q = excludeDraft.trim().toLowerCase();
    if (!q) return [];
    return neighborhoods
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 40);
  }, [neighborhoods, excludeDraft]);

  const opportunitiesQs = useMemo(() => {
    const p = new URLSearchParams();
    if (city !== "all") p.set("city", city);
    if (propertyType !== "all" && propertyType.trim()) p.set("propertyType", propertyType.trim());
    if (neighborhood !== "all" && neighborhood.trim()) p.set("neighborhood", neighborhood.trim());
    for (const ex of excludedNeighborhoods) {
      const t = ex.trim();
      if (t) p.append("excludeNeighborhood", t);
    }
    const maxDigits = maxPriceCop.replace(/\D/g, "");
    const maxParsed = maxDigits ? Number.parseInt(maxDigits, 10) : Number.NaN;
    if (Number.isFinite(maxParsed) && maxParsed >= 1) {
      p.set("maxPriceCop", String(maxParsed));
    }
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
      if (similarFilters.estrato) p.set("estrato", similarFilters.estrato);
      if (similarFilters.conjunto) p.set("conjunto", similarFilters.conjunto);
    }
    const minDisc = minDiscountPct.trim();
    if (minDisc !== "") {
      const parsed = Number.parseFloat(minDisc);
      if (Number.isFinite(parsed) && parsed >= 0) {
        p.set("minDiscountPct", String(parsed));
      }
    }
    if (excludeBarter) p.set("excludeBarter", "1");
    if (excludeProjects) p.set("excludeProjects", "1");
    if (excludeUnknownNeighborhoods) p.set("excludeUnknownNeighborhoods", "1");
    if (!hideLowConfidence) p.set("hideLowConfidence", "0");
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [
    city,
    excludeBarter,
    excludeProjects,
    excludeUnknownNeighborhoods,
    excludedNeighborhoods,
    hideLowConfidence,
    maxPriceCop,
    minDiscountPct,
    neighborhood,
    propertyType,
    similarFilters,
  ]);

  const clearSimilarFilters = () => {
    setSimilarFilters(null);
    setMaxPriceCop("");
  };

  const sortedRows = useMemo(() => {
    const confidenceWeight: Record<NonNullable<OpportunityRow["confidence"]>, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    return [...rows].sort((a, b) => {
      if (sortBy === "discount") {
        const da = a.discountVsRefPct;
        const db = b.discountVsRefPct;
        const va = da != null && Number.isFinite(da) ? da : -999;
        const vb = db != null && Number.isFinite(db) ? db : -999;
        return vb - va;
      }
      if (sortBy === "price") {
        const pa = Number(String(a.priceCop).replace(/\D/g, ""));
        const pb = Number(String(b.priceCop).replace(/\D/g, ""));
        const va = Number.isFinite(pa) ? pa : 0;
        const vb = Number.isFinite(pb) ? pb : 0;
        return va - vb;
      }
      if (sortBy === "confidence") {
        const aw = a.confidence ? confidenceWeight[a.confidence] : 0;
        const bw = b.confidence ? confidenceWeight[b.confidence] : 0;
        return bw - aw;
      }
      const sa = a.dealScore;
      const sb = b.dealScore;
      const va = sa != null && Number.isFinite(sa) ? sa : -999;
      const vb = sb != null && Number.isFinite(sb) ? sb : -999;
      return vb - va;
    });
  }, [rows, sortBy]);

  const addExcludedFromDraft = useCallback(() => {
    const t = excludeDraft.trim();
    if (!t) return;
    setExcludedNeighborhoods((prev) =>
      prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t],
    );
    setExcludeDraft("");
  }, [excludeDraft]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (rows.length === 0) setLoading(true);
    setError(null);
    try {
      const filtersUrl = `/api/filters${city !== "all" ? `?city=${encodeURIComponent(city)}` : ""}`;
      const [fJson, oJson] = await Promise.all([
        fetchJsonCached<{
          cities?: string[];
          neighborhoods?: string[];
          propertyTypes?: string[];
        }>(filtersUrl),
        fetchJsonCached<{ opportunities?: OpportunityRow[] }>(
          `/api/opportunities${opportunitiesQs}`,
        ),
      ]);
      if (signal?.aborted) return;
      setCities(fJson.cities ?? []);
      setNeighborhoods(fJson.neighborhoods ?? []);
      setPropertyTypes(fJson.propertyTypes ?? []);
      setRows((oJson.opportunities ?? []) as OpportunityRow[]);
      setExpandedId(null);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(uiText[lang].couldNotLoad);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [city, opportunitiesQs, lang, rows.length]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.opportunitiesTitle}
        subtitle={txt.opportunitiesPurpose}
        active="opportunities"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        ) : null}

        {similarFilters ? (
          <Card className="mb-6 border-accent/30 bg-accent/5 p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {txt.opportunitiesSimilarBannerTitle}
                </p>
                <p className="mt-1 text-sm text-muted">{txt.opportunitiesSimilarBannerBody}</p>
              </div>
              <button
                type="button"
                onClick={clearSimilarFilters}
                className="shrink-0 rounded-lg border border-slate-200/90 bg-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface dark:border-slate-700/80"
              >
                {txt.opportunitiesSimilarClear}
              </button>
            </div>
          </Card>
        ) : null}

        <Card className="mb-6 border-slate-200/90 p-4 shadow-card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{txt.opportunitiesPrimaryFilters}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-muted" htmlFor="opp-city">{txt.city}</label>
            <select
              id="opp-city"
              className={`${inputClassName} sm:min-w-[180px]`}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setNeighborhood("all");
                setExcludedNeighborhoods([]);
              }}
            >
              <option value="all">{txt.allCities}</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-muted" htmlFor="opp-type">{txt.type}</label>
            <select
              id="opp-type"
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
            <label className="block text-xs font-medium text-muted" htmlFor="opp-neighborhood">{txt.neighborhood}</label>
            <select
              id="opp-neighborhood"
              className={`${inputClassName} sm:min-w-[170px]`}
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
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-muted">
              {txt.opportunitiesMaxPrice}
            </label>
            <input
              id="opp-max-price"
              type="text"
              inputMode="numeric"
              className={`${inputClassName} sm:min-w-[180px]`}
              value={maxPriceCop}
              onChange={(e) => setMaxPriceCop(e.target.value)}
              placeholder={txt.opportunitiesMaxPricePlaceholder}
            />
            <p className="mt-1 max-w-xs text-xs text-muted">{txt.opportunitiesMaxPriceHint}</p>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-muted" htmlFor="opp-min-discount">
              {txt.opportunitiesMinDiscount}
            </label>
            <input
              id="opp-min-discount"
              type="text"
              inputMode="decimal"
              className={`${inputClassName} sm:min-w-[120px]`}
              value={minDiscountPct}
              onChange={(e) => setMinDiscountPct(e.target.value)}
              placeholder="5"
            />
            <p className="mt-1 max-w-xs text-xs text-muted">{txt.opportunitiesMinDiscountHint}</p>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-muted" htmlFor="opp-sortby">
              {txt.opportunitiesSortedBy}
            </label>
            <select
              id="opp-sortby"
              className={`${inputClassName} sm:min-w-[190px]`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="dealScore">{txt.opportunitiesSortByDealScore}</option>
              <option value="discount">{txt.opportunitiesSortByDiscount}</option>
              <option value="price">{txt.opportunitiesSortByPrice}</option>
              <option value="confidence">{txt.opportunitiesSortByConfidence}</option>
            </select>
          </div>
          <Button
            type="button"
            className="bg-accent py-2.5 text-accent-fg hover:bg-accent-hover"
            onClick={() => void load()}
          >
            {txt.refresh}
          </Button>
          </div>
          <CollapsibleSection title={txt.toggleAdvancedFilters} className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-surface/70 px-3 py-2.5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={excludeUnknownNeighborhoods}
                onChange={(e) => setExcludeUnknownNeighborhoods(e.target.checked)}
              />
              <span>{txt.opportunitiesExcludeUnknown}</span>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface/70 px-3 py-2.5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={hideLowConfidence}
                onChange={(e) => setHideLowConfidence(e.target.checked)}
              />
              <span>{txt.opportunitiesHideLowConfidence}</span>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface/70 px-3 py-2.5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={excludeBarter}
                onChange={(e) => setExcludeBarter(e.target.checked)}
              />
              <span>{txt.opportunitiesExcludeBarter}</span>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-surface/70 px-3 py-2.5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={excludeProjects}
                onChange={(e) => setExcludeProjects(e.target.checked)}
              />
              <span>{txt.opportunitiesExcludeProjects}</span>
            </label>
          </div>
          </div>

          <div className="mt-4 w-full basis-full border-t border-slate-100 pt-4">
            <label className="block text-xs font-medium text-muted" htmlFor="opp-exclude-input">
              {txt.opportunitiesExcludeNeighborhoods}
            </label>
            <div className="mt-2 flex max-w-2xl flex-wrap items-center gap-2">
              <input
                id="opp-exclude-input"
                type="text"
                className={`min-w-[200px] flex-1 ${inputClassName}`}
                value={excludeDraft}
                onChange={(e) => setExcludeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExcludedFromDraft();
                  }
                }}
                placeholder={txt.opportunitiesExcludePlaceholder}
                list="opp-exclude-datalist"
                autoComplete="off"
              />
              <datalist id="opp-exclude-datalist">
                {excludeSuggestions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <Button
                type="button"
                variant="secondary"
                className="bg-surface px-4 py-2.5 text-slate-800 shadow-sm hover:bg-slate-100"
                onClick={() => addExcludedFromDraft()}
              >
                {txt.opportunitiesExcludeAdd}
              </Button>
            </div>
            {excludedNeighborhoods.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {excludedNeighborhoods.map((ex) => (
                  <span
                    key={ex}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800"
                  >
                    {ex}
                    <button
                      type="button"
                      className="ml-0.5 rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                      aria-label={lang === "es" ? "Quitar" : "Remove"}
                      onClick={() =>
                        setExcludedNeighborhoods((prev) => prev.filter((x) => x !== ex))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 max-w-2xl text-xs text-muted">{txt.opportunitiesExcludeHint}</p>
          </div>
          </CollapsibleSection>
        </Card>

        <Card className="overflow-hidden border-slate-200/90 p-0 shadow-card">
          <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3 text-sm font-semibold text-slate-800">
            {txt.opportunitiesTop10} · {txt.opportunitiesSortedBy}:{" "}
            {sortBy === "dealScore"
              ? txt.opportunitiesSortByDealScore
              : sortBy === "discount"
                ? txt.opportunitiesSortByDiscount
                : sortBy === "price"
                  ? txt.opportunitiesSortByPrice
                  : txt.opportunitiesSortByConfidence}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.listing}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.city}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.neighborhood}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.price}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.pricePerM2}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.opportunitiesMetric}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.opportunityDiscount}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.dealScore}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.opportunitiesSignals}</th>
                  <th className="px-4 py-3 font-medium text-slate-700">{txt.opportunitiesConfidence}</th>
                  <th className="w-10 px-2 py-3" aria-label={txt.opportunitiesWhyDeal} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        <td className="px-4 py-3" colSpan={11}>
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))}
                  </>
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={11}>
                      {txt.opportunitiesEmpty} {txt.adjustFiltersHint}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => {
                    const tags = signalTags(r, txt, lang);
                    const isExpanded = expandedId === r.id;
                    return (
                    <Fragment key={r.id}>
                    <tr className="hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md bg-surface">
                            {r.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : null}
                          </div>
                          <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                            {r.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.city}</td>
                      <td className="px-4 py-3">
                        {r.neighborhood ?? txt.unknown}
                        {r.zoneName ? (
                          <span className="ml-1 text-xs text-muted">({r.zoneName})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtCop(Number(r.priceCop), locale)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtCop(r.pricePerM2, locale)}</td>
                      <td className="px-4 py-3">{metricTypeLabel(r.metricType, txt)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.discountVsRefPct == null ? "—" : `${r.discountVsRefPct.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.dealScore?.toFixed(1) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/80"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{confidenceLabel(r.confidence, txt)}</td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? txt.opportunitiesWhyDealCollapse
                              : txt.opportunitiesWhyDealExpand
                          }
                          title={txt.opportunitiesWhyDeal}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : r.id)
                          }
                        >
                          <svg
                            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-surface/30">
                        <td className="px-4 py-3" colSpan={11}>
                          <div className="space-y-4">
                            {r.priceTimeline && r.priceTimeline.length > 1 ? (
                              <div className="rounded-xl border border-slate-200/90 bg-elevated px-3 py-2 dark:border-slate-700/80">
                                <p className="mb-1 text-xs font-medium text-muted">
                                  {txt.priceTimelineTitle}
                                </p>
                                <PriceTimelineChart
                                  points={r.priceTimeline.map((p) => ({
                                    recordedAt: p.recordedAt,
                                    priceCop: Number(p.priceCop),
                                  }))}
                                  locale={locale}
                                  noDataLabel={txt.analyzePriceTimelineEmpty}
                                  tooltipLabel={txt.analyzePriceTimelineTooltip}
                                  compact
                                />
                              </div>
                            ) : null}
                            {r.whyDeal ? (
                              <WhyDealPanel
                                whyDeal={r.whyDeal}
                                title={txt.opportunitiesWhyDeal}
                                lang={lang}
                                locale={locale}
                              />
                            ) : null}
                            <NearbyAmenitiesSection
                              latitude={r.latitude}
                              longitude={r.longitude}
                              lang={lang}
                              locale={locale}
                              enabled={isExpanded}
                              compact
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`mob-skel-${i}`} className="h-36 w-full" />
              ))
            ) : sortedRows.length === 0 ? (
              <p className="text-sm text-muted">
                {txt.opportunitiesEmpty} {txt.adjustFiltersHint}
              </p>
            ) : (
              sortedRows.map((r) => {
                const tags = signalTags(r, txt, lang)
                const isExpanded = expandedId === r.id
                return (
                  <OpportunityMobileCard
                    key={r.id}
                    title={r.title}
                    url={r.url}
                    location={`${r.city} · ${r.neighborhood ?? txt.unknown}`}
                    price={fmtCop(Number(r.priceCop), locale)}
                    pricePerM2={fmtCop(r.pricePerM2, locale)}
                    pricePerM2Num={r.pricePerM2}
                    refAvg={r.refAvgUsed}
                    locale={locale}
                    discount={
                      r.discountVsRefPct == null ? "—" : `${r.discountVsRefPct.toFixed(1)}%`
                    }
                    dealScore={r.dealScore?.toFixed(1) ?? "—"}
                    confidence={confidenceLabel(r.confidence, txt)}
                    sampleSize={r.compSampleSize}
                    imageUrl={r.imageUrl}
                    priceLabel={txt.price}
                    pricePerM2Label={txt.pricePerM2}
                    discountLabel={txt.opportunityDiscount}
                    dealScoreLabel={txt.dealScore}
                    tags={tags}
                    expanded={isExpanded}
                    expandLabel={txt.opportunitiesWhyDealExpand}
                    collapseLabel={txt.opportunitiesWhyDealCollapse}
                    onToggle={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    {r.whyDeal ? (
                      <WhyDealPanel
                        whyDeal={r.whyDeal}
                        title={txt.opportunitiesWhyDeal}
                        lang={lang}
                        locale={locale}
                      />
                    ) : null}
                    <NearbyAmenitiesSection
                      latitude={r.latitude}
                      longitude={r.longitude}
                      lang={lang}
                      locale={locale}
                      enabled={isExpanded}
                      compact
                    />
                  </OpportunityMobileCard>
                )
              })
            )}
          </div>
        </Card>
      </main>
      <PageFooter />
    </div>
  );
}
