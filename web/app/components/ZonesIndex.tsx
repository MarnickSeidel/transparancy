"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import SiteHeader from "@/app/components/SiteHeader";
import Card from "@/app/components/ui/Card";
import SearchableSelect, { matchesSearchQuery } from "@/app/components/ui/SearchableSelect";
import { inputClassName } from "@/app/components/ui/Field";
import Skeleton from "@/app/components/ui/Skeleton";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
import { cityDisplayName } from "@/lib/cityNames";
import { localePath, type Locale } from "@/lib/locale";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

type ZoneRow = {
  slug: string;
  displayName: string;
  city: string;
  citySlug: string;
  listingCount: number;
  dataPointCount: number;
  medianPricePerM2: number | null;
};

type ZonesResponse = {
  city: string;
  citySlug: string;
  minDataPoints: number;
  minCount: number;
  zones: ZoneRow[];
};

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

type Props = {
  locale?: Locale;
  initialCities?: string[];
  initialCity?: string;
  initialData?: ZonesResponse;
};

export default function ZonesIndex({
  locale: pageLocale = "es",
  initialCities,
  initialCity,
  initialData,
}: Props = {}) {
  const { lang, toggleLang } = useUiLang(pageLocale);
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";
  const lp = (path: string) => localePath(lang, path);
  const router = useRouter();

  const [city, setCity] = useState(initialCity ?? DEFAULT_ZONE_CITY);
  const [cities, setCities] = useState<string[]>(initialCities ?? [DEFAULT_ZONE_CITY]);
  const [data, setData] = useState<ZonesResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(initialData == null);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [citiesRes, zonesRes] = await Promise.all([
        fetch(`/api/zones/cities?minDataPoints=${DEFAULT_MIN_ZONE_DATA_POINTS}`),
        fetch(
          `/api/zones?city=${encodeURIComponent(city)}&minDataPoints=${DEFAULT_MIN_ZONE_DATA_POINTS}`,
        ),
      ]);
      if (!zonesRes.ok) throw new Error("load");
      if (citiesRes.ok) {
        const citiesJson = (await citiesRes.json()) as { cities?: string[] };
        const list = citiesJson.cities ?? [];
        if (list.length > 0) setCities(list);
      }
      const zonesJson = (await zonesRes.json()) as ZonesResponse;
      setData(zonesJson);
    } catch {
      setError(txt.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [city, txt.couldNotLoad]);

  useEffect(() => {
    if (initialData != null && city === (initialCity ?? DEFAULT_ZONE_CITY)) return;
    void load();
  }, [load, initialData, initialCity, city]);

  const zones = data?.zones ?? [];
  const minDataPoints = data?.minDataPoints ?? data?.minCount ?? DEFAULT_MIN_ZONE_DATA_POINTS;
  const citySlug = data?.citySlug ?? city.toLowerCase().replace(/\s+/g, "-");

  const zoneOptions = useMemo(
    () => zones.map((zone) => ({ value: zone.slug, label: zone.displayName })),
    [zones],
  );

  const filteredZones = useMemo(() => {
    if (!filterQuery.trim()) return zones;
    return zones.filter((zone) =>
      matchesSearchQuery(zone.displayName, filterQuery, "contains"),
    );
  }, [filterQuery, zones]);

  const handleZoneSelect = useCallback(
    (slug: string) => {
      if (!slug) return;
      router.push(lp(`/zones/${citySlug}/${slug}`));
    },
    [citySlug, lp, router],
  );

  const handleQueryChange = useCallback((query: string) => {
    setFilterQuery(query);
  }, []);

  useEffect(() => {
    setFilterQuery("");
  }, [city]);

  const subtitle = useMemo(
    () => fmtTemplate(txt.zonesMinCountNote, { n: minDataPoints }),
    [minDataPoints, txt.zonesMinCountNote],
  );

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.zonesTitle}
        subtitle={`${txt.zonesPurpose} · ${subtitle}`}
        active="zones"
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
          <label className="block text-xs font-medium text-muted" htmlFor="zones-city">
            {txt.city}
          </label>
          <select
            id="zones-city"
            className={`${inputClassName} min-w-[200px]`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {cityDisplayName(c)}
              </option>
            ))}
          </select>
          <Link
            href={lp(`/zones/${citySlug}`)}
            className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
          >
            {lang === "en" ? `View all ${city} neighborhoods →` : `Ver todos los barrios en ${city} →`}
          </Link>
        </Card>

        {!loading && zones.length > 0 ? (
          <Card className="mb-6 border-slate-200/90 p-4 shadow-card">
            <label className="block text-xs font-medium text-muted" htmlFor="zones-barrio-search">
              {txt.zonesSearchLabel}
            </label>
            <SearchableSelect
              id="zones-barrio-search"
              options={zoneOptions}
              value=""
              onChange={handleZoneSelect}
              onQueryChange={handleQueryChange}
              filterMode="contains"
              placeholder={txt.zonesSearchPlaceholder}
              noResultsLabel={txt.zonesSearchNoResults}
              openListLabel={txt.searchableSelectOpenList}
              closeListLabel={txt.searchableSelectCloseList}
              aria-label={txt.zonesSearchPlaceholder}
              className="mt-1.5 max-w-xl"
            />
            {filterQuery.trim() ? (
              <p className="mt-2 text-xs text-muted">
                {fmtTemplate(txt.zonesSearchResults, { count: filteredZones.length })}
              </p>
            ) : null}
          </Card>
        ) : null}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{txt.zonesEmpty}</p>
          </Card>
        ) : filteredZones.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">{txt.zonesSearchNoResults}</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredZones.map((zone) => (
              <Link
                key={zone.slug}
                href={lp(`/zones/${citySlug}/${zone.slug}`)}
                className="group block"
              >
                <Card className="h-full border-slate-200/90 shadow-card transition-transform group-hover:-translate-y-0.5">
                  <h2 className="text-lg font-semibold text-foreground">
                    {zone.displayName}
                  </h2>
                  <p className="mt-1 text-xs text-muted">{cityDisplayName(zone.city)}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {txt.zonesActiveListings}
                      </dt>
                      <dd className="mt-1 font-semibold tabular-nums text-foreground">
                        {zone.listingCount.toLocaleString(locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {txt.zonesDataPoints}
                      </dt>
                      <dd className="mt-1 font-semibold tabular-nums text-foreground">
                        {zone.dataPointCount.toLocaleString(locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        {txt.zonesMedianPpm2}
                      </dt>
                      <dd className="mt-1 font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                        {fmtCop(zone.medianPricePerM2, locale)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
