"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import SiteHeader from "@/app/components/SiteHeader";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import { BUCKET_COLORS, type PriceBucket } from "@/lib/mapPriceBuckets";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

type ListingRow = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  propertyType: string | null;
  estrato: number | null;
  priceCop: string;
  areaM2: number;
  pricePerM2: number | null;
  url: string;
  priceBucket: PriceBucket | null;
  deltaVsRefPct: number | null;
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

export default function ListingExplorer() {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [estratos, setEstratos] = useState<number[]>([]);

  const [city, setCity] = useState(() => initialParam("city"));
  const [neighborhood, setNeighborhood] = useState(() => initialParam("neighborhood"));
  const [propertyType, setPropertyType] = useState(() => initialParam("propertyType"));
  const [estrato, setEstrato] = useState(() => initialParam("estrato"));
  const [maxPriceCop, setMaxPriceCop] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "pricePerM2" | "area">("date");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ListingsResponse | null>(null);
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
    if (sortBy !== "date") p.set("sortBy", sortBy);
    p.set("page", String(page));
    return p.toString();
  }, [city, estrato, maxPriceCop, neighborhood, page, propertyType, sortBy]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fRes, lRes] = await Promise.all([
        fetch(`/api/filters${city !== "all" ? `?city=${encodeURIComponent(city)}` : ""}`),
        fetch(`/api/listings?${queryString}`),
      ]);
      if (!fRes.ok || !lRes.ok) throw new Error("load");
      const fJson = await fRes.json();
      const lJson = (await lRes.json()) as ListingsResponse;
      setCities(fJson.cities ?? []);
      setNeighborhoods(fJson.neighborhoods ?? []);
      setPropertyTypes(fJson.propertyTypes ?? []);
      setEstratos(fJson.estratos ?? []);
      setData(lJson);
    } catch {
      setError(txt.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [city, queryString, txt.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [city, neighborhood, propertyType, estrato, maxPriceCop, sortBy]);

  const rows = data?.listings ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.exploreTitle}
        subtitle={txt.explorePurpose}
        active="explore"
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
                    {c}
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
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-muted" htmlFor="exp-neighborhood">
                {txt.neighborhood}
              </label>
              <select
                id="exp-neighborhood"
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
                placeholder="350000000"
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
                <option value="area">{txt.exploreSortArea}</option>
              </select>
            </div>
            <Button onClick={() => void load()} disabled={loading}>
              {loading ? "…" : txt.refresh}
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden border-slate-200/90 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
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
            <div className="px-4 py-10 text-center text-sm text-muted">…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">{txt.exploreEmpty}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted dark:bg-slate-900/60">
                  <tr>
                    <th className="px-4 py-3">{txt.explorePriceSignal}</th>
                    <th className="px-4 py-3">{txt.type}</th>
                    <th className="px-4 py-3">{txt.cityLabel}</th>
                    <th className="px-4 py-3">{txt.neighborhood}</th>
                    <th className="px-4 py-3">{txt.medianPriceM2}</th>
                    <th className="px-4 py-3">{txt.exploreSortPrice}</th>
                    <th className="px-4 py-3">{txt.exploreSortArea}</th>
                    <th className="px-4 py-3" />
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
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {row.propertyType ?? txt.unknown}
                          </p>
                          <p className="mt-1 max-w-xs truncate text-xs text-muted">{row.title}</p>
                        </td>
                        <td className="px-4 py-3">{row.city}</td>
                        <td className="px-4 py-3">{row.neighborhood ?? txt.unknown}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtCop(row.pricePerM2, locale)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtCop(Number(row.priceCop), locale)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.areaM2.toLocaleString(locale)} m²
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
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
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 dark:border-slate-700">
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
      </main>

      <PageFooter />
    </div>
  );
}
