"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import EmailSignupForm from "@/app/components/EmailSignupForm";
import PageFooter from "@/app/components/PageFooter";
import NearbyAmenitiesSection from "@/app/components/NearbyAmenitiesSection";
import PriceRangeBar from "@/app/components/PriceRangeBar";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import SearchableSelect from "@/app/components/ui/SearchableSelect";
import Skeleton from "@/app/components/ui/Skeleton";
import { mapCenterForCity, nearestCityFromCoords } from "@/lib/cityCenters";
import { fetchJsonCached } from "@/lib/clientFetchCache";
import type { FiltersData } from "@/lib/getFiltersData";
import SiteHeader from "@/app/components/SiteHeader";
import { cityNameToSlug } from "@/lib/getCityFromSlug";
import { formatFreshnessDate } from "@/lib/getDataFreshness";
import { estimateFallbackLabel } from "@/lib/estimateLabels";
import { uiText } from "@/lib/i18n";
import { normalizeNeighborhoodKey, resolveNeighborhoodLabel } from "@/lib/neighborhoods";
import { propertyTypeLabel, propertyTypeOptions } from "@/lib/propertyTypes";
import { similarListingsHref, similarOpportunitiesHref } from "@/lib/similarListingsQuery";
import { localePath, localeToolPath } from "@/lib/locale";
import { useUiLang } from "@/lib/useUiLang";

const EstimateMapPicker = dynamic(() => import("./EstimateMapPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface text-sm text-muted">
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
  disclaimerKey: string;
};

type SubmittedSnapshot = {
  neighborhood: string;
  propertyType: string;
  estrato: string;
  useGeo: boolean;
};

type LocationMode = "barrio" | "map";

const AREA_PRESETS = [45, 60, 70, 90, 120] as const;

const LOCATION_PROMPT_KEY = "estimate-location-prompt-dismissed";

function fmtTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? ""),
  );
}

function readUrlParams() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

function fmtMoney(n: number, locale: string) {
  return `$ ${Math.round(n).toLocaleString(locale)}`;
}

export default function EstimateForm({
  initialFilters,
}: {
  initialFilters?: FiltersData;
}) {
  const router = useRouter();
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";
  const resultRef = useRef<HTMLDivElement>(null);

  const [cities, setCities] = useState<string[]>(initialFilters?.cities ?? []);
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    initialFilters?.neighborhoods ?? [],
  );
  const [estratos, setEstratos] = useState<number[]>(initialFilters?.estratos ?? []);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    initialFilters?.propertyTypes ?? [],
  );

  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [estrato, setEstrato] = useState("");
  const [areaM2, setAreaM2] = useState("");

  const [locationMode, setLocationMode] = useState<LocationMode>("barrio");
  const useGeo = locationMode === "map";
  const [mapMarker, setMapMarker] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusMeters, setRadiusMeters] = useState(500);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedSnapshot | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(!initialFilters);

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [pendingNeighborhoodParam, setPendingNeighborhoodParam] = useState("");
  const [freshnessDate, setFreshnessDate] = useState<string | null>(null);

  const loadFilters = useCallback(async (citySlug: string) => {
    setFiltersLoading(true);
    try {
      const q =
        citySlug && citySlug.length > 0
          ? `?city=${encodeURIComponent(citySlug)}`
          : "";
      const j = await fetchJsonCached<{
        cities?: string[];
        neighborhoods?: string[];
        estratos?: number[];
        propertyTypes?: string[];
      }>(`/api/filters${q}`);
      setCities(j.cities ?? []);
      setNeighborhoods(j.neighborhoods ?? []);
      setEstratos(j.estratos ?? []);
      setPropertyTypes(j.propertyTypes ?? []);
      setFilterError(null);
    } catch {
      setFilterError(txt.couldNotLoad);
    } finally {
      setFiltersLoading(false);
    }
  }, [txt.couldNotLoad]);

  useEffect(() => {
    if (initialFilters && !city) return;
    void loadFilters(city);
  }, [city, loadFilters, initialFilters]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(LOCATION_PROMPT_KEY)) return;
    setShowLocationPrompt(true);
  }, []);

  useEffect(() => {
    if (urlHydrated) return;
    const params = readUrlParams();
    if (!params) return;

    const urlCity = params.get("city")?.trim() ?? "";
    if (urlCity) setCity(urlCity);

    const urlArea = params.get("areaM2")?.trim() ?? "";
    if (urlArea) setAreaM2(urlArea);

    const urlType = params.get("propertyType")?.trim() ?? "";
    if (urlType) setPropertyType(urlType);

    const urlEstrato = params.get("estrato")?.trim() ?? "";
    if (urlEstrato) setEstrato(urlEstrato);

    const urlNeighborhood = params.get("neighborhood")?.trim() ?? "";
    if (urlNeighborhood) setPendingNeighborhoodParam(urlNeighborhood);

    const geoOn =
      params.get("geo") === "1" ||
      (params.has("lat") && params.has("lng"));
    if (geoOn) {
      setLocationMode("map");
      const lat = Number.parseFloat(params.get("lat") ?? "");
      const lng = Number.parseFloat(params.get("lng") ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setMapMarker({ lat, lng });
      }
      const radius = Number.parseInt(params.get("radius") ?? "", 10);
      if (Number.isFinite(radius) && radius > 0) setRadiusMeters(radius);
    }

    setUrlHydrated(true);
    if (urlCity || urlNeighborhood || geoOn) {
      setShowLocationPrompt(false);
    }
  }, [urlHydrated]);

  useEffect(() => {
    if (!pendingNeighborhoodParam || neighborhoods.length === 0) return;
    setNeighborhood(
      resolveNeighborhoodLabel(pendingNeighborhoodParam, neighborhoods),
    );
    setPendingNeighborhoodParam("");
  }, [pendingNeighborhoodParam, neighborhoods]);

  useEffect(() => {
    void fetchJsonCached<{ lastScrapedAt?: string | null }>("/api/freshness")
      .then((j) => {
        if (!j?.lastScrapedAt) return;
        const label = formatFreshnessDate(new Date(j.lastScrapedAt), locale);
        if (label) setFreshnessDate(label);
      })
      .catch(() => undefined);
  }, [locale]);

  useEffect(() => {
    if (!result) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const cityOptions = useMemo(
    () => cities.map((c) => ({ value: c, label: c })),
    [cities],
  );

  const neighborhoodOptions = useMemo(
    () => neighborhoods.map((n) => ({ value: n, label: n })),
    [neighborhoods],
  );

  const syncEstimateUrl = useCallback(
    (snapshot: SubmittedSnapshot, area: number) => {
      const p = new URLSearchParams();
      p.set("city", city.trim());
      p.set("areaM2", String(area));
      if (snapshot.propertyType) p.set("propertyType", snapshot.propertyType);
      if (snapshot.estrato) p.set("estrato", snapshot.estrato);
      if (snapshot.useGeo && mapMarker) {
        p.set("geo", "1");
        p.set("lat", String(mapMarker.lat));
        p.set("lng", String(mapMarker.lng));
        p.set("radius", String(radiusMeters));
      } else if (snapshot.neighborhood) {
        p.set("neighborhood", snapshot.neighborhood);
      }
      router.replace(`/estimate?${p.toString()}`, { scroll: false });
    },
    [city, mapMarker, radiusMeters, router],
  );

  const applyGeolocation = useCallback(
    (lat: number, lng: number) => {
      setLocationMode("map");
      setMapMarker({ lat, lng });
      setNeighborhood("");
      setGeoHint(null);

      const nearest = nearestCityFromCoords(lat, lng);
      if (!nearest) return;

      if (!city.trim()) {
        setCity(nearest.city);
        setGeoHint(fmtTemplate(txt.estimateGeolocationCitySet, { city: nearest.city }));
        return;
      }

      if (city.trim() !== nearest.city && nearest.distanceM > 25000) {
        setGeoHint(
          fmtTemplate(txt.estimateGeolocationCityMismatch, { city: nearest.city }),
        );
      }
    },
    [city, txt.estimateGeolocationCityMismatch, txt.estimateGeolocationCitySet],
  );

  const handleUseMyLocation = useCallback(() => {
    setError(null);
    setShowLocationPrompt(false);
    sessionStorage.setItem(LOCATION_PROMPT_KEY, "1");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(txt.estimateGeolocationUnsupported);
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyGeolocation(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(txt.estimateGeolocationDenied);
          return;
        }
        setError(txt.estimateGeolocationError);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, [
    applyGeolocation,
    txt.estimateGeolocationDenied,
    txt.estimateGeolocationError,
    txt.estimateGeolocationUnsupported,
  ]);

  const handleDismissLocationPrompt = useCallback(() => {
    setShowLocationPrompt(false);
    sessionStorage.setItem(LOCATION_PROMPT_KEY, "1");
  }, []);

  const resultLinks = useMemo(() => {
    if (!result || !submitted) return null;
    const exploreHref = similarListingsHref(result, submitted, lang);
    const opportunitiesHref = similarOpportunitiesHref(result, submitted, lang);
    const p = new URLSearchParams();
    p.set("city", result.city);
    const nb = submitted.useGeo ? "" : submitted.neighborhood.trim();
    if (nb) p.set("neighborhood", nb);
    if (submitted.propertyType.trim()) p.set("propertyType", submitted.propertyType.trim());
    const analyzeHref = localeToolPath(lang, "/analyze-url", p.toString());
    const zoneHref =
      nb && result.city
        ? localePath(lang, `/zones/${encodeURIComponent(cityNameToSlug(result.city))}/${encodeURIComponent(normalizeNeighborhoodKey(nb))}`)
        : null;
    return { exploreHref, opportunitiesHref, analyzeHref, zoneHref };
  }, [result, submitted, lang]);

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
    let cityToUse = city.trim();
    if (useGeo && mapMarker && !cityToUse) {
      const nearest = nearestCityFromCoords(mapMarker.lat, mapMarker.lng);
      if (nearest) {
        cityToUse = nearest.city;
        setCity(nearest.city);
      }
    }
    if (!cityToUse) {
      setError(txt.estimateCityRequired);
      return;
    }
    if (useGeo) {
      if (!mapMarker) {
        setError(txt.estimateMapPickRequired);
        return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        city: cityToUse,
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
      const snap: SubmittedSnapshot = {
        neighborhood: neighborhood.trim(),
        propertyType: propertyType.trim(),
        estrato: estrato.trim(),
        useGeo,
      };
      setSubmitted(snap);
      syncEstimateUrl(snap, area);
    } catch {
      setError(txt.estimateServerError);
    } finally {
      setLoading(false);
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

      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        {filterError && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {filterError}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        )}

        {showLocationPrompt ? (
          <Card className="mb-6 border-accent/30 bg-accent/5 p-4 shadow-card sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {txt.estimateLocationPromptTitle}
            </h2>
            <p className="mt-2 text-sm text-muted">{txt.estimateLocationPromptBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                className="bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-60"
              >
                {geoLoading ? txt.estimateUseMyLocationLoading : txt.estimateLocationPromptUse}
              </Button>
              <button
                type="button"
                onClick={handleDismissLocationPrompt}
                className="rounded-xl border border-border-subtle bg-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
              >
                {txt.estimateLocationPromptDismiss}
              </button>
            </div>
          </Card>
        ) : null}

        <Card className="space-y-4 border-border-subtle shadow-card sm:p-8">
        <form id="estimate-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <p className="text-xs text-muted">{txt.requiredFieldLegend}</p>
          <h2 className="text-sm font-semibold text-foreground">{txt.estimateSectionLocation}</h2>
          <div className="relative z-20">
            <label className="block text-xs font-medium text-muted" htmlFor="estimate-city">
              {txt.city} *
            </label>
            {filtersLoading ? (
              <Skeleton className="mt-1 h-10 w-full rounded-lg" />
            ) : (
              <SearchableSelect
                id="estimate-city"
                required
                value={city}
                options={cityOptions}
                filterMode="auto"
                placeholder={txt.searchableSelectPlaceholder}
                noResultsLabel={txt.searchableSelectNoMatch}
                openListLabel={txt.searchableSelectOpenList}
                closeListLabel={txt.searchableSelectCloseList}
                aria-label={`${txt.city} *`}
                onChange={(next) => {
                  if (next !== city) {
                    setMapMarker(null);
                    setGeoHint(null);
                  }
                  setCity(next);
                  setNeighborhood("");
                }}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["barrio", txt.estimateLocationModeBarrio],
                  ["map", txt.estimateLocationModeMap],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={locationMode === mode}
                  className={
                    locationMode === mode
                      ? "rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
                      : "rounded-xl border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                  }
                  onClick={() => {
                    setLocationMode(mode);
                    setGeoHint(null);
                    if (mode === "barrio") setMapMarker(null);
                    else setNeighborhood("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {locationMode === "map" ? (
              <p className="text-xs text-muted">{txt.estimateLocationMapRecommend}</p>
            ) : null}
          </div>

          {locationMode === "barrio" ? (
            <div className="relative z-10">
              <label
                className="block text-xs font-medium text-muted"
                htmlFor="estimate-neighborhood"
              >
                {txt.neighborhood}
              </label>
              {filtersLoading && city ? (
                <Skeleton className="mt-1 h-10 w-full rounded-lg" />
              ) : (
                <SearchableSelect
                  id="estimate-neighborhood"
                  allowEmpty
                  emptyLabel={txt.operationAny}
                  disabled={!city}
                  value={neighborhood}
                  options={neighborhoodOptions}
                  filterMode="auto"
                  placeholder={txt.searchableSelectPlaceholder}
                  noResultsLabel={txt.searchableSelectNoMatch}
                  openListLabel={txt.searchableSelectOpenList}
                  closeListLabel={txt.searchableSelectCloseList}
                  aria-label={txt.neighborhood}
                  onChange={setNeighborhood}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface/90 p-4">
              {!city && !mapMarker ? (
                <p className="text-xs text-amber-800">{txt.estimateMapCityFirst}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={geoLoading}
                  className="bg-accent text-sm text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                >
                  {geoLoading ? txt.estimateUseMyLocationLoading : txt.estimateUseMyLocation}
                </Button>
              </div>
              {geoHint ? (
                <p className="text-xs text-teal-800 dark:text-teal-200">{geoHint}</p>
              ) : null}
              <p className="text-xs text-muted">{txt.estimateMapHint}</p>
              {(city || mapMarker) ? (
                <>
                  {city ? (
                    <div>
                      <label className="block text-xs font-medium text-muted" htmlFor="estimate-radius">
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
                  ) : null}
                  {city ? (
                    <p className="text-xs text-muted">{txt.estimateMapNeighborhoodOff}</p>
                  ) : null}
                  <EstimateMapPicker
                    center={
                      mapMarker
                        ? [mapMarker.lat, mapMarker.lng]
                        : city
                          ? mapCenterForCity(city)
                          : [4.65, -74.05]
                    }
                    marker={mapMarker}
                    onPick={(lat, lng) => setMapMarker({ lat, lng })}
                  />
                </>
              ) : null}
            </div>
          )}

          <h2 className="pt-2 text-sm font-semibold text-foreground">{txt.estimateSectionProperty}</h2>
          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="estimate-property-type">
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
            <label className="block text-xs font-medium text-muted" htmlFor="estimate-estrato">
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
            <label className="block text-xs font-medium text-muted" htmlFor="estimate-area">
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
            <div className="mt-2 flex flex-wrap gap-2">
              {AREA_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`${preset} m²`}
                  className={
                    areaM2 === String(preset)
                      ? "rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg"
                      : "rounded-lg border border-border-subtle bg-elevated px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
                  }
                  onClick={() => setAreaM2(String(preset))}
                >
                  {preset} m²
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{txt.estimateAreaHint}</p>
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
          <Card className="mt-8 space-y-4 border-border-subtle p-6 shadow-card">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full" />
          </Card>
        ) : null}

        {result && submitted && (
          <div ref={resultRef} className="mt-8 space-y-4">
            <Card className="space-y-4 border-border-subtle shadow-card sm:p-8">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">{txt.estimateSectionResult}</h2>
                <p className="text-sm text-muted">
                  {fmtTemplate(txt.estimateResultHeadline, { area: result.areaM2 })}
                </p>
                <p className="text-sm text-muted">
                  {[
                    result.city,
                    submitted.useGeo
                      ? txt.estimateLocationModeMap
                      : submitted.neighborhood || null,
                    submitted.propertyType
                      ? propertyTypeLabel(submitted.propertyType, lang)
                      : null,
                    submitted.estrato ? `${txt.estrato} ${submitted.estrato}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {txt.estimateResultMedian}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                  {fmtMoney(result.totalCop.mid, locale)}
                </p>
                <p className="mt-1 text-sm tabular-nums text-muted">
                  {fmtMoney(result.totalCop.low, locale)} – {fmtMoney(result.totalCop.high, locale)}
                </p>
              </div>

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
              <div className="border-t border-border-subtle pt-4 text-sm text-muted">
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
              <div className="rounded-xl border border-border-subtle bg-surface/70 p-3 text-sm">
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
                <p className="text-sm text-muted">
                  {txt.estimateFallbackNote}{" "}
                  {result.fallbackDropped
                    .map((key) => estimateFallbackLabel(key, lang))
                    .join(", ")}
                </p>
              )}
              {result.geo && (
                <p className="text-sm text-foreground">
                  {txt.estimateGeoUsed.replace(
                    "{n}",
                    result.geo.radiusMeters.toLocaleString(locale),
                  )}
                </p>
              )}
              {result.geoDropped && (
                <p className="text-sm text-amber-900">{txt.estimateGeoDropped}</p>
              )}
              {freshnessDate ? (
                <p className="text-xs text-muted">
                  {fmtTemplate(txt.estimateResultFreshness, { date: freshnessDate })}
                </p>
              ) : null}
              <Link
                href={lang === "en" ? "/en/methodology" : "/methodology"}
                className="inline-block text-sm font-medium text-accent hover:underline"
              >
                {txt.estimateResultMethodology}
              </Link>
              <p className="text-xs text-muted">{txt.estimateDisclaimer}</p>
            </Card>

            {submitted.useGeo && mapMarker ? (
              <NearbyAmenitiesSection
                latitude={mapMarker.lat}
                longitude={mapMarker.lng}
                lang={lang}
                locale={locale}
              />
            ) : null}

            {resultLinks ? (
              <div className="space-y-4">
                <Card className="border-accent/30 bg-accent/5 shadow-card sm:p-6">
                  <h3 className="text-base font-semibold text-foreground">
                    {txt.estimateResultAnalyzeTitle}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{txt.estimateResultAnalyzeBody}</p>
                  <Button href={resultLinks.analyzeHref} className="mt-4">
                    {txt.estimateResultAnalyzeButton}
                  </Button>
                </Card>

                <Card className="border-border-subtle p-4 shadow-card sm:p-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    {txt.estimateResultMarketTitle}
                  </h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {resultLinks.zoneHref ? (
                      <li>
                        <Link
                          href={resultLinks.zoneHref}
                          className="flex h-full rounded-xl border border-border-subtle bg-surface/60 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent/5"
                        >
                          {txt.estimateResultNextZone} →
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <Link
                        href={resultLinks.exploreHref}
                        className="flex h-full rounded-xl border border-border-subtle bg-surface/60 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent/5"
                      >
                        {txt.estimateResultNextExplore} →
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={resultLinks.opportunitiesHref}
                        className="flex h-full rounded-xl border border-border-subtle bg-surface/60 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent/5"
                      >
                        {txt.estimateResultNextOpportunities} →
                      </Link>
                    </li>
                  </ul>
                </Card>

                <EmailSignupForm
                  lang={lang}
                  source="estimate_result"
                  title={txt.estimateSubscribeTitle}
                  hint={fmtTemplate(txt.estimateSubscribeHint, { city: result.city })}
                  defaultCity={result.city}
                  defaultNeighborhood={submitted?.neighborhood || neighborhood || undefined}
                  defaultLists={["deals_city", "market_monthly_city"]}
                  visibleLists={["deals_city", "price_drops_city", "market_monthly_city"]}
                  collapsedByDefault
                />
              </div>
            ) : null}
          </div>
        )}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-background/90 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden">
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
