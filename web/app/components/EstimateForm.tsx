"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import PriceRangeBar from "@/app/components/PriceRangeBar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import Skeleton from "@/app/components/ui/Skeleton";
import { mapCenterForCity } from "@/lib/cityCenters";
import SiteHeader from "@/app/components/SiteHeader";
import { uiText } from "@/lib/i18n";
import { propertyTypeLabel, propertyTypeOptions } from "@/lib/propertyTypes";
import { useUiLang } from "@/lib/useUiLang";

const EstimateMapPicker = dynamic(() => import("./EstimateMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
      ...
    </div>
  ),
});

type EstimateResponse = {
  sampleSize: number;
  minSampleSize: number;
  minSampleMet: boolean;
  ppm2: { p25: number; median: number; p75: number };
  totalCop: { low: number; mid: number; high: number };
  areaM2: number;
  city: string;
  filtersUsed: {
    neighborhood: boolean;
    propertyType: boolean;
    estrato: boolean;
    conjunto: boolean;
  };
  fallbackDropped: string[];
  geo: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  geoDropped: boolean;
  appliedConjunto?: string | null;
  disclaimerKey: string;
};

type SubmittedSnapshot = {
  neighborhood: string;
  propertyType: string;
  estrato: string;
  conjunto: string;
  useGeo: boolean;
};

function fmtMoney(n: number, locale: string) {
  return `$ ${Math.round(n).toLocaleString(locale)}`;
}

export default function EstimateForm() {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [estratos, setEstratos] = useState<number[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [conjuntosCity, setConjuntosCity] = useState<string[]>([]);

  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [estrato, setEstrato] = useState("");
  const [areaM2, setAreaM2] = useState("");

  const [useGeo, setUseGeo] = useState(false);
  const [mapMarker, setMapMarker] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusMeters, setRadiusMeters] = useState(500);

  const [liveInConjunto, setLiveInConjunto] = useState(false);
  const [conjunto, setConjunto] = useState("");
  const [conjuntoNearby, setConjuntoNearby] = useState<
    { name: string; count: number }[]
  >([]);
  const [conjuntoNearbyLoading, setConjuntoNearbyLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedSnapshot | null>(null);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const loadFilters = useCallback(async (citySlug: string) => {
    try {
      const q =
        citySlug && citySlug.length > 0
          ? `?city=${encodeURIComponent(citySlug)}`
          : "";
      const res = await fetch(`/api/filters${q}`);
      if (!res.ok) {
        setError(txt.couldNotLoad);
        return;
      }
      const j = await res.json();
      setCities(j.cities ?? []);
      setNeighborhoods(j.neighborhoods ?? []);
      setEstratos(j.estratos ?? []);
      setPropertyTypes(j.propertyTypes ?? []);
      setConjuntosCity(j.conjuntos ?? []);
      setError(null);
    } catch {
      setError(txt.couldNotLoad);
    }
  }, [txt.couldNotLoad]);

  useEffect(() => {
    void loadFilters("");
  }, [loadFilters]);

  useEffect(() => {
    if (city) void loadFilters(city);
  }, [city, loadFilters]);

  useEffect(() => {
    setMapMarker(null);
  }, [city]);

  useEffect(() => {
    if (!liveInConjunto || !useGeo || !mapMarker || !city.trim()) {
      setConjuntoNearby([]);
      return;
    }
    let cancelled = false;
    setConjuntoNearbyLoading(true);
    const u = new URL("/api/estimate/conjuntos-nearby", window.location.origin);
    u.searchParams.set("city", city.trim());
    u.searchParams.set("latitude", String(mapMarker.lat));
    u.searchParams.set("longitude", String(mapMarker.lng));
    u.searchParams.set("radiusMeters", "2000");
    void fetch(u.toString())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("nearby"))))
      .then((j: { conjuntos?: { name: string; count: number }[] }) => {
        if (!cancelled) setConjuntoNearby(j.conjuntos ?? []);
      })
      .catch(() => {
        if (!cancelled) setConjuntoNearby([]);
      })
      .finally(() => {
        if (!cancelled) setConjuntoNearbyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [liveInConjunto, useGeo, mapMarker, city]);

  const conjuntoSelectOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const n of conjuntoNearby) {
      if (n.name && !seen.has(n.name)) {
        seen.add(n.name);
        out.push({
          value: n.name,
          label: `${n.name} (${n.count})`,
        });
      }
    }
    for (const c of conjuntosCity) {
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push({ value: c, label: c });
      }
    }
    return out;
  }, [conjuntoNearby, conjuntosCity]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!city.trim()) {
      setError(txt.estimateCityRequired);
      return;
    }
    const area = Number.parseFloat(areaM2.replace(",", "."));
    if (!Number.isFinite(area) || area <= 0) {
      setError(txt.estimateAreaInvalid);
      return;
    }
    if (useGeo) {
      if (!city.trim()) {
        setError(txt.estimateMapCityFirst);
        return;
      }
      if (!mapMarker) {
        setError(txt.estimateMapPickRequired);
        return;
      }
    }
    if (liveInConjunto) {
      if (!conjunto.trim()) {
        setError(txt.estimateConjuntoRequired);
        return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        city: city.trim(),
        neighborhood:
          useGeo ? undefined : neighborhood.trim() || undefined,
        propertyType: propertyType.trim() || undefined,
        areaM2: area,
        estrato: estrato && estrato !== "" ? Number.parseInt(estrato, 10) : undefined,
      };
      if (useGeo && mapMarker) {
        payload.latitude = mapMarker.lat;
        payload.longitude = mapMarker.lng;
        payload.radiusMeters = radiusMeters;
      }
      if (liveInConjunto && conjunto.trim()) {
        payload.conjunto = conjunto.trim();
      }
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 422) {
          setError(txt.estimateNoData);
        } else if (res.status === 400) {
          const err = j.error as string | undefined;
          if (err === "city_required") setError(txt.estimateCityRequired);
          else if (err === "coordinates_invalid" || err === "coordinates_incomplete")
            setError(txt.estimateCoordsInvalid);
          else setError(txt.estimateAreaInvalid);
        } else {
          setError(txt.estimateServerError);
        }
        return;
      }
      setResult(j as EstimateResponse);
      setSubmitted({
        neighborhood: neighborhood.trim(),
        propertyType: propertyType.trim(),
        estrato: estrato.trim(),
        conjunto: conjunto.trim(),
        useGeo,
      });
    } catch {
      setError(txt.estimateServerError);
    } finally {
      setLoading(false);
    }
  };

  const onSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribeError(null);
    setSubscribeMessage(null);
    const email = subscribeEmail.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      setSubscribeError(txt.subscribeInvalidEmail);
      return;
    }
    setSubscribeLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "estimate_result",
          city: city.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        if (res.status === 400 && j.error === "invalid_email") {
          setSubscribeError(txt.subscribeInvalidEmail);
        } else {
          setSubscribeError(txt.subscribeError);
        }
        return;
      }
      setSubscribeMessage(txt.subscribeSuccess);
      setSubscribeEmail("");
    } catch {
      setSubscribeError(txt.subscribeError);
    } finally {
      setSubscribeLoading(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.estimateTitle}
        subtitle={txt.estimatePurpose}
        active="estimate"
        lang={lang}
        onToggleLang={toggleLang}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        )}

        <Card className="space-y-4 border-slate-200/90 shadow-card sm:p-8">
        <form id="estimate-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <p className="text-xs text-slate-500">{txt.requiredFieldLegend}</p>
          <h2 className="text-sm font-semibold text-slate-800">{txt.estimateSectionLocation}</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-city">
              {txt.city} *
            </label>
            <select
              id="estimate-city"
              required
              className={inputClassName}
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setNeighborhood("");
              }}
            >
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {!useGeo ? (
            <div>
              <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-neighborhood">
                {txt.neighborhood}
              </label>
              <select
                id="estimate-neighborhood"
                className={inputClassName}
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                disabled={!city}
              >
                <option value="">{txt.operationAny}</option>
                {neighborhoods.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <h2 className="pt-2 text-sm font-semibold text-slate-800">{txt.estimateSectionProperty}</h2>
          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-property-type">
              {txt.type}
            </label>
            <select
              id="estimate-property-type"
              className={inputClassName}
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
            >
              <option value="">{txt.operationAny}</option>
              {propertyTypeOptions(propertyTypes, lang).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-estrato">
              {txt.estrato}
            </label>
            <select
              id="estimate-estrato"
              className={inputClassName}
              value={estrato}
              onChange={(e) => setEstrato(e.target.value)}
            >
              <option value="">{txt.operationAny}</option>
              {estratos.map((e) => (
                <option key={e} value={String(e)}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-area">
              {txt.estimateArea} *
            </label>
            <input
              id="estimate-area"
              type="text"
              inputMode="decimal"
              required
              className={inputClassName}
              value={areaM2}
              onChange={(e) => setAreaM2(e.target.value)}
              placeholder="70"
            />
            <p className="mt-1 text-xs text-slate-500">{txt.estimateAreaHint}</p>
          </div>

          <h2 className="pt-2 text-sm font-semibold text-slate-800">{txt.estimateSectionAdvanced}</h2>
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={useGeo}
                disabled={!city}
                onChange={(e) => {
                  const on = e.target.checked;
                  setUseGeo(on);
                  if (on) setNeighborhood("");
                  else setMapMarker(null);
                }}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {txt.estimateMapUse}
                </span>
                <span className="mt-1 block text-xs text-slate-600">
                  {txt.estimateMapHint}
                </span>
              </span>
            </label>
            {!city && (
              <p className="mt-2 text-xs text-amber-800">{txt.estimateMapCityFirst}</p>
            )}
            {useGeo && city ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted">{txt.estimateLoadingMap}</p>
                <p className="text-xs text-slate-600">{txt.estimateMapNeighborhoodOff}</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-radius">
                    {txt.estimateMapRadius}
                  </label>
                  <select
                    id="estimate-radius"
                    className={`${inputClassName} max-w-xs`}
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  >
                    {[500, 1000, 2000, 3000, 5000, 8000, 12000].map((m) => (
                      <option key={m} value={m}>
                        {m.toLocaleString(locale)} m
                      </option>
                    ))}
                  </select>
                </div>
                <EstimateMapPicker
                  center={mapCenterForCity(city)}
                  marker={mapMarker}
                  onPick={(lat, lng) => setMapMarker({ lat, lng })}
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/90 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={liveInConjunto}
                onChange={(e) => {
                  const on = e.target.checked;
                  setLiveInConjunto(on);
                  if (!on) setConjunto("");
                }}
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">
                  {txt.estimateLiveInConjunto}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {txt.estimateLiveInConjuntoHint}
                </span>
              </span>
            </label>
            {liveInConjunto ? (
              <div className="mt-4 space-y-2">
                {liveInConjunto && useGeo && mapMarker && conjuntoNearbyLoading ? (
                  <p className="text-xs text-muted">{txt.estimateConjuntoLoading}</p>
                ) : null}
                {liveInConjunto &&
                useGeo &&
                mapMarker &&
                !conjuntoNearbyLoading &&
                conjuntoNearby.length === 0 ? (
                  <p className="text-xs text-amber-900">{txt.estimateConjuntoNearbyEmpty}</p>
                ) : null}
                <div>
                  <label className="block text-xs font-medium text-muted" htmlFor="estimate-conjunto">
                    {txt.estimateConjuntoSelect}
                  </label>
                  <select
                    id="estimate-conjunto"
                    className={inputClassName}
                    value={conjunto}
                    onChange={(e) => setConjunto(e.target.value)}
                    disabled={conjuntoSelectOptions.length === 0}
                  >
                    <option value="">—</option>
                    {conjuntoSelectOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="hidden w-full bg-accent py-3 text-accent-fg hover:bg-accent-hover disabled:opacity-60 md:inline-flex"
          >
            {loading ? txt.estimateCalculating : txt.estimateSubmit}
          </Button>
        </form>
        </Card>

        {loading ? (
          <Card className="mt-8 space-y-4 border-slate-200/90 p-6 shadow-card">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : null}

        {result && submitted && (
          <div className="mt-8 space-y-4">
            <Card className="space-y-4 border-slate-200/90 shadow-card sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">{txt.estimateSectionResult}</h2>
              <p className="text-sm text-muted">{txt.estimateRangeExplain}</p>
              <PriceRangeBar
                low={result.totalCop.low}
                mid={result.totalCop.mid}
                high={result.totalCop.high}
                locale={locale}
                lowLabel="P25"
                midLabel={txt.median}
                highLabel="P75"
              />
              <div className="border-t border-slate-100 pt-4 text-sm text-muted dark:border-slate-700">
                <p className="font-medium text-foreground">{txt.estimatePpm2Band}</p>
                <p className="mt-1 tabular-nums">
                  {fmtMoney(result.ppm2.p25, locale)} –{" "}
                  {fmtMoney(result.ppm2.median, locale)} –{" "}
                  {fmtMoney(result.ppm2.p75, locale)}
                </p>
              </div>
              <p className="text-sm text-muted">
                {txt.estimateSample}: {result.sampleSize} (min {result.minSampleSize})
              </p>
              <div className="rounded-xl border border-slate-200 bg-surface/70 p-3 text-sm dark:border-slate-700">
                <p className="font-medium text-foreground">{txt.estimateDriversTitle}</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>{txt.city}: {result.city}</li>
                  <li>
                    {txt.neighborhood}:{" "}
                    {submitted.useGeo
                      ? txt.estimateFilterNotUsed
                      : submitted.neighborhood || txt.estimateFilterNotUsed}
                  </li>
                  <li>
                    {txt.type}:{" "}
                    {submitted.propertyType
                      ? propertyTypeLabel(submitted.propertyType, lang)
                      : txt.estimateFilterNotUsed}
                  </li>
                  <li>
                    {txt.estrato}:{" "}
                    {submitted.estrato ? submitted.estrato : txt.estimateFilterNotUsed}
                  </li>
                  <li>
                    {txt.estimateConjuntoSelect}:{" "}
                    {submitted.conjunto || txt.estimateFilterNotUsed}
                  </li>
                </ul>
              </div>
              <p className="text-sm">
                {result.minSampleMet ? (
                  <span className="text-emerald-800">{txt.estimateQualityOk}</span>
                ) : (
                  <span className="text-amber-800">{txt.estimateQualityLow}</span>
                )}
              </p>
              {result.fallbackDropped.length > 0 && (
                <p className="text-sm text-slate-600">
                  {txt.estimateFallbackNote}{" "}
                  {result.fallbackDropped.join(", ")}
                </p>
              )}
              {result.geo && (
                <p className="text-sm text-slate-700">
                  {txt.estimateGeoUsed.replace(
                    "{n}",
                    result.geo.radiusMeters.toLocaleString(locale),
                  )}
                </p>
              )}
              {result.geoDropped && (
                <p className="text-sm text-amber-900">{txt.estimateGeoDropped}</p>
              )}
              {result.appliedConjunto ? (
                <p className="text-sm text-slate-700">
                  {txt.estimateConjuntoApplied.replace("{name}", result.appliedConjunto)}
                </p>
              ) : null}
              <p className="text-xs text-muted">{txt.estimateDisclaimer}</p>
            </Card>

            <details className="rounded-2xl border border-slate-200/90 bg-elevated p-4 shadow-card dark:border-slate-700/80">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                {txt.subscribeTitle}
              </summary>
              <p className="mt-2 text-sm text-muted">{txt.subscribeHint}</p>
              <form onSubmit={(e) => void onSubscribe(e)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600" htmlFor="estimate-subscribe-email">
                    {txt.subscribeEmailLabel}
                  </label>
                  <input
                    id="estimate-subscribe-email"
                    type="email"
                    required
                    className={inputClassName}
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    placeholder={txt.subscribeEmailPlaceholder}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={subscribeLoading}
                  className="bg-accent py-2.5 text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                >
                  {subscribeLoading ? txt.subscribeSending : txt.subscribeCta}
                </Button>
              </form>
              {subscribeError ? (
                <p className="mt-3 text-sm text-amber-900">{subscribeError}</p>
              ) : null}
              {subscribeMessage ? (
                <p className="mt-3 text-sm text-emerald-800">{subscribeMessage}</p>
              ) : null}
            </details>
          </div>
        )}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-background/90 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-700/80 md:hidden">
        <Button
          type="submit"
          form="estimate-form"
          disabled={loading}
          className="w-full bg-accent py-3.5 text-accent-fg shadow-lg hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? txt.estimateCalculating : txt.estimateSubmit}
        </Button>
      </div>
      <PageFooter />
    </div>
  );
}
