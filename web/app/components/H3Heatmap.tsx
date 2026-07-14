"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import SiteHeader from "@/app/components/SiteHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import { fetchJsonCached } from "@/lib/clientFetchCache";
import { mapCenterForCity } from "@/lib/cityCenters";
import type { H3HeatCell } from "@/lib/h3Heatmap";
import { BUCKET_COLORS } from "@/lib/mapPriceBuckets";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

const H3HeatmapMap = dynamic(() => import("@/app/components/H3HeatmapMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(70vh,640px)] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
      …
    </div>
  ),
});

type HeatmapResponse = {
  city: string;
  resolution: number;
  cells: H3HeatCell[];
  scale: { p25: number | null; p50: number | null; p75: number | null };
  listingCount: number;
  cellCount: number;
  minSampleMet: boolean;
};

type SelectedCell = {
  h3Index: string;
  count: number;
  medianPpm2: number;
  bucket: 0 | 1 | 2 | 3;
  topNeighborhood: string | null;
};

function initialParam(name: string, fallback = "all"): string {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(name)?.trim();
  return v && v.length > 0 ? v : fallback;
}

export default function H3Heatmap({
  initialFilters,
}: {
  initialFilters?: {
    cities?: string[];
    propertyTypes?: string[];
    estratos?: number[];
  };
}) {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [cities, setCities] = useState<string[]>(initialFilters?.cities ?? []);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    initialFilters?.propertyTypes ?? [],
  );
  const [estratos, setEstratos] = useState<number[]>(initialFilters?.estratos ?? []);

  const [city, setCity] = useState(() => initialParam("city", "Pereira"));
  const [propertyType, setPropertyType] = useState(() => initialParam("propertyType"));
  const [estrato, setEstrato] = useState(() => initialParam("estrato"));
  const [resolution, setResolution] = useState(() =>
    Number.parseInt(initialParam("resolution", "8"), 10),
  );

  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [dossierHref, setDossierHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fmtPpm2 = useCallback(
    (v: number) => `$ ${Math.round(v).toLocaleString(locale)}`,
    [locale],
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("city", city);
    p.set("resolution", String(resolution));
    if (propertyType !== "all") p.set("propertyType", propertyType);
    if (estrato !== "all") p.set("estrato", estrato);
    return p.toString();
  }, [city, estrato, propertyType, resolution]);

  const exploreHref = useMemo(() => {
    if (!selected) return `/explore?city=${encodeURIComponent(city)}`;
    const p = new URLSearchParams();
    p.set("city", city);
    if (selected.topNeighborhood) {
      p.set("neighborhood", selected.topNeighborhood);
    }
    return `/explore?${p.toString()}`;
  }, [city, selected]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!data) setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const filtersUrl = `/api/filters?city=${encodeURIComponent(city)}`;
      const [fJson, hJson] = await Promise.all([
        fetchJsonCached<{
          cities?: string[];
          propertyTypes?: string[];
          estratos?: number[];
        }>(filtersUrl),
        fetchJsonCached<HeatmapResponse>(`/api/heatmap/h3?${queryString}`),
      ]);
      if (signal?.aborted) return;
      setCities(fJson.cities ?? []);
      setPropertyTypes(fJson.propertyTypes ?? []);
      setEstratos(fJson.estratos ?? []);
      setData(hJson);
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
    if (!selected?.topNeighborhood) {
      setDossierHref(null);
      return;
    }
    const p = new URLSearchParams({
      city,
      neighborhood: selected.topNeighborhood,
    });
    void fetch(`/api/zones/resolve?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { published?: boolean; href?: string | null } | null) => {
        setDossierHref(json?.published && json.href ? json.href : null);
      })
      .catch(() => setDossierHref(null));
  }, [city, selected]);

  const bucketLegend = [
    { bucket: 0 as const, label: txt.exploreSignalBelow },
    { bucket: 1 as const, label: txt.exploreSignalNearLow },
    { bucket: 2 as const, label: txt.exploreSignalAbove },
    { bucket: 3 as const, label: txt.exploreSignalHigh },
  ];

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.heatmapTitle}
        subtitle={txt.heatmapPurpose}
        active="heatmap"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        ) : null}

        <Card className="mb-6 border-slate-200/90 p-4 shadow-card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {txt.opportunitiesPrimaryFilters}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="hm-city">
                {txt.city}
              </label>
              <select
                id="hm-city"
                className={`${inputClassName} sm:min-w-[180px]`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {cities.length === 0 ? (
                  <option value={city}>{city}</option>
                ) : (
                  cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="hm-type">
                {txt.type}
              </label>
              <select
                id="hm-type"
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
              <label className="block text-xs font-medium text-muted" htmlFor="hm-estrato">
                {txt.estrato}
              </label>
              <select
                id="hm-estrato"
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
              <label className="block text-xs font-medium text-muted" htmlFor="hm-res">
                {txt.heatmapResolution}
              </label>
              <select
                id="hm-res"
                className={`${inputClassName} sm:min-w-[150px]`}
                value={String(resolution)}
                onChange={(e) => setResolution(Number.parseInt(e.target.value, 10))}
              >
                <option value="7">{txt.heatmapResCoarse}</option>
                <option value="8">{txt.heatmapResCity}</option>
                <option value="9">{txt.heatmapResFine}</option>
              </select>
            </div>
            <Button onClick={() => void load()} disabled={loading}>
              {loading ? "…" : txt.refresh}
            </Button>
          </div>
        </Card>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          {bucketLegend.map((item) => (
            <div key={item.bucket} className="flex items-center gap-2 text-xs text-muted">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: BUCKET_COLORS[item.bucket].fill }}
              />
              {item.label}
            </div>
          ))}
        </div>

        {data && !data.minSampleMet ? (
          <Card className="mb-4 border-slate-200/90 p-4 text-sm text-muted shadow-card">
            {txt.heatmapNotEnoughData}
          </Card>
        ) : null}

        {data?.minSampleMet ? (
          <p className="mb-3 text-xs text-muted">
            {txt.heatmapSummary
              .replace("{listings}", data.listingCount.toLocaleString(locale))
              .replace("{cells}", data.cellCount.toLocaleString(locale))
              .replace("{city}", data.city)}
          </p>
        ) : null}

        <H3HeatmapMap
          center={mapCenterForCity(city)}
          cells={data?.cells ?? []}
          onCellSelect={setSelected}
          formatPpm2={fmtPpm2}
          tooltipForCell={(cell) =>
            `${fmtPpm2(cell.medianPpm2)} · ${cell.count} ${txt.heatmapListingsShort}${
              cell.topNeighborhood ? ` · ${cell.topNeighborhood}` : ""
            }`
          }
        />

        {selected ? (
          <Card className="mt-4 border-slate-200/90 p-4 shadow-card">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {txt.heatmapSelectedCell}
            </p>
            <p className="mt-2 text-sm text-muted">
              {txt.medianPriceM2}: {fmtPpm2(selected.medianPpm2)}
            </p>
            <p className="text-sm text-muted">
              {txt.sample}: {selected.count}
            </p>
            {selected.topNeighborhood ? (
              <p className="text-sm text-muted">
                {txt.neighborhood}: {selected.topNeighborhood}
              </p>
            ) : null}
            <Link
              href={exploreHref}
              className="mt-3 inline-flex text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
            >
              {txt.heatmapOpenExplorer}
            </Link>
            {dossierHref ? (
              <Link
                href={dossierHref}
                className="mt-2 block text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
              >
                {txt.viewBarrioDossier}
              </Link>
            ) : null}
          </Card>
        ) : null}
      </main>

      <PageFooter />
    </div>
  );
}
