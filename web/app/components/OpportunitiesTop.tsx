"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import SiteHeader from "@/app/components/SiteHeader";
import type { DealFlag, DealScoreBreakdown, WhyDeal } from "@/lib/dealEngine";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

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
  scoreBreakdown?: DealScoreBreakdown | null;
  whyDeal?: WhyDeal | null;
  discountVsRefPct: number | null;
  confidence?: "high" | "medium" | "low";
  confidenceReasons?: string[];
  priceDropPct?: number | null;
  acceptsBarter?: boolean;
  isProject?: boolean;
  url: string;
  sourceUpdatedAt: string | null;
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

function compMethodLabel(method: string | undefined, lang: "es" | "en") {
  if (!method) return "—";
  const labels: Record<string, { es: string; en: string }> = {
    geo_1km: { es: "geo 1 km", en: "geo 1 km" },
    zone: { es: "zona", en: "zone" },
    neighborhood: { es: "barrio", en: "neighborhood" },
    city: { es: "ciudad", en: "city" },
  };
  return labels[method]?.[lang] ?? method;
}

function dealFlagLabel(
  flag: DealFlag,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
): string {
  const key = `dealFlag_${flag}` as keyof typeof txt;
  return (txt[key] as string | undefined) ?? flag;
}

function dealNoteLabel(
  note: string,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
): string {
  const key = `dealNote_${note}` as keyof typeof txt;
  return (txt[key] as string | undefined) ?? note;
}

function scoreDrivers(
  bd: DealScoreBreakdown | null | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
): { label: string; value: number }[] {
  if (!bd) return [];
  const rows: { label: string; value: number }[] = [];
  if (bd.discountComponent !== 0) {
    rows.push({ label: txt.dealScoreDriver_discount, value: bd.discountComponent });
  }
  if (bd.freshnessComponent !== 0) {
    rows.push({ label: txt.dealScoreDriver_freshness, value: bd.freshnessComponent });
  }
  if (bd.completenessComponent !== 0) {
    rows.push({ label: txt.dealScoreDriver_completeness, value: bd.completenessComponent });
  }
  if (bd.priceDropBonus !== 0) {
    rows.push({ label: txt.dealScoreDriver_price_drop, value: bd.priceDropBonus });
  }
  if (bd.domBonus !== 0) {
    rows.push({ label: txt.dealScoreDriver_dom, value: bd.domBonus });
  }
  if (bd.barterPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_barter, value: -bd.barterPenalty });
  }
  if (bd.projectPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_project, value: -bd.projectPenalty });
  }
  if (bd.promotedPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_promoted, value: -bd.promotedPenalty });
  }
  if (bd.lowSamplePenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_low_sample, value: -bd.lowSamplePenalty });
  }
  if (bd.highAdminPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_high_admin, value: -bd.highAdminPenalty });
  }
  if (bd.terrainRiskPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_terrain_risk, value: -bd.terrainRiskPenalty });
  }
  if (bd.typeLocationPenalty !== 0) {
    rows.push({ label: txt.dealScoreDriver_type_location, value: -bd.typeLocationPenalty });
  }
  return rows;
}

function WhyDealPanel({
  row,
  txt,
  locale,
  lang,
}: {
  row: OpportunityRow;
  txt: (typeof uiText)["es"] | (typeof uiText)["en"];
  locale: string;
  lang: "es" | "en";
}) {
  const why = row.whyDeal;
  if (!why) return null;

  const drivers = scoreDrivers(why.scoreBreakdown, txt);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {txt.opportunitiesWhyDeal}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyCompMethod}</p>
          <p className="mt-0.5 text-sm text-foreground">
            {compMethodLabel(why.compMethod, lang)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {txt.opportunitiesWhyCompCount}: {why.compSampleSize}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyDiscount}</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
            {why.discountPct == null ? "—" : `${why.discountPct.toFixed(1)}%`}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyMedianComp}</p>
          <p className="mt-0.5 text-sm tabular-nums text-foreground">
            {fmtCop(why.medianCompPricePerM2, locale)}
          </p>
          <p className="mt-1 text-xs text-muted">{metricTypeLabel(why.metricType, txt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesConfidence}</p>
          <p className="mt-0.5 text-sm text-foreground">{confidenceLabel(why.confidence, txt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyFlags}</p>
          {why.flags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {why.flags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/80"
                >
                  {dealFlagLabel(flag, txt)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">{txt.opportunitiesWhyNoFlags}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyConfidence}</p>
          {why.confidenceNotes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-foreground">
              {why.confidenceNotes.map((note) => (
                <li key={note}>{dealNoteLabel(note, txt)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">{txt.opportunitiesWhyNoNotes}</p>
          )}
        </div>
      </div>

      {drivers.length > 0 ? (
        <div className="mt-4 border-t border-slate-200/80 pt-3">
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyScoreDrivers}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {drivers.map((d) => (
              <span
                key={d.label}
                className={`text-xs tabular-nums ${
                  d.value >= 0 ? "text-emerald-800" : "text-rose-800"
                }`}
              >
                {d.value >= 0 ? "+" : ""}
                {d.value.toFixed(1)} {d.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function signalTags(
  row: OpportunityRow,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  const tags: string[] = [];
  if (row.acceptsBarter) tags.push(txt.opportunitiesFlagBarter);
  if (row.isProject) tags.push(txt.opportunitiesFlagProject);
  if (row.priceDropPct != null && row.priceDropPct >= 2) {
    tags.push(txt.opportunitiesFlagPriceDrop.replace("{pct}", row.priceDropPct.toFixed(0)));
  }
  return tags;
}

/** Read ?city=&neighborhood=&propertyType= on first client paint (page is loaded with ssr:false). */
function initialOppParam(name: string): string {
  if (typeof window === "undefined") return "all";
  const v = new URLSearchParams(window.location.search).get(name)?.trim();
  return v && v.length > 0 ? v : "all";
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
  const [maxPriceCop, setMaxPriceCop] = useState("");
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
  ]);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, oRes] = await Promise.all([
        fetch(`/api/filters${city !== "all" ? `?city=${encodeURIComponent(city)}` : ""}`),
        fetch(`/api/opportunities${opportunitiesQs}`),
      ]);
      if (!fRes.ok || !oRes.ok) throw new Error("load");
      const fJson = await fRes.json();
      const oJson = await oRes.json();
      setCities(fJson.cities ?? []);
      setNeighborhoods(fJson.neighborhoods ?? []);
      setPropertyTypes(fJson.propertyTypes ?? []);
      setRows((oJson.opportunities ?? []) as OpportunityRow[]);
      setExpandedId(null);
    } catch {
      setError(uiText[lang].couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [city, opportunitiesQs, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.opportunitiesTitle}
        subtitle={txt.opportunitiesPurpose}
        active="opportunities"
        lang={lang}
        onToggleLang={toggleLang}
        txt={txt}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
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
              {propertyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              placeholder="350000000"
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
          <p className="mt-4 text-xs text-muted">{txt.opportunitiesAdvancedFilters}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
          <div className="overflow-x-auto">
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
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={11}>
                      {txt.estimateCalculating}
                    </td>
                  </tr>
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-500" colSpan={11}>
                      {txt.opportunitiesEmpty} {txt.adjustFiltersHint}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => {
                    const tags = signalTags(r, txt);
                    const isExpanded = expandedId === r.id;
                    return (
                    <Fragment key={r.id}>
                    <tr className="hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                          {r.title}
                        </a>
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
                          <WhyDealPanel row={r} txt={txt} locale={locale} lang={lang} />
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
        </Card>
      </main>
      <PageFooter />
    </div>
  );
}
