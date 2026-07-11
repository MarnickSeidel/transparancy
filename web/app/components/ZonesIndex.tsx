"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import SiteHeader from "@/app/components/SiteHeader";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import Skeleton from "@/app/components/ui/Skeleton";
import { DEFAULT_MIN_ZONE_DATA_POINTS, DEFAULT_ZONE_CITY } from "@/lib/zones";
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

export default function ZonesIndex() {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [city, setCity] = useState(DEFAULT_ZONE_CITY);
  const [cities, setCities] = useState<string[]>([DEFAULT_ZONE_CITY]);
  const [data, setData] = useState<ZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [filtersRes, zonesRes] = await Promise.all([
        fetch("/api/filters"),
        fetch(
          `/api/zones?city=${encodeURIComponent(city)}&minDataPoints=${DEFAULT_MIN_ZONE_DATA_POINTS}`,
        ),
      ]);
      if (!filtersRes.ok || !zonesRes.ok) throw new Error("load");
      const filtersJson = await filtersRes.json();
      const zonesJson = (await zonesRes.json()) as ZonesResponse;
      setCities(filtersJson.cities?.length ? filtersJson.cities : [DEFAULT_ZONE_CITY]);
      setData(zonesJson);
    } catch {
      setError(txt.couldNotLoad);
    } finally {
      setLoading(false);
    }
  }, [city, txt.couldNotLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const zones = data?.zones ?? [];
  const minDataPoints = data?.minDataPoints ?? data?.minCount ?? DEFAULT_MIN_ZONE_DATA_POINTS;
  const citySlug = data?.citySlug ?? city.toLowerCase().replace(/\s+/g, "-");

  const subtitle = useMemo(
    () => fmtTemplate(txt.zonesMinCountNote, { n: minDataPoints }),
    [minDataPoints, txt.zonesMinCountNote],
  );

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.zonesTitle}
        subtitle={`${txt.zonesPurpose} ${subtitle}`}
        active="zones"
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
                {c}
              </option>
            ))}
          </select>
        </Card>

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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((zone) => (
              <Link
                key={zone.slug}
                href={`/zones/${citySlug}/${zone.slug}`}
                className="group block"
              >
                <Card className="h-full border-slate-200/90 shadow-card transition-transform group-hover:-translate-y-0.5">
                  <h2 className="text-lg font-semibold text-foreground">
                    {zone.displayName}
                  </h2>
                  <p className="mt-1 text-xs text-muted">{zone.city}</p>
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
