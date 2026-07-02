"use client";

import { useMemo, useState } from "react";

import PageFooter from "@/app/components/PageFooter";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { inputClassName } from "@/app/components/ui/Field";
import SiteHeader from "@/app/components/SiteHeader";
import { uiText } from "@/lib/i18n";
import { useUiLang } from "@/lib/useUiLang";

type AnalyzeResponse = {
  listing: {
    title: string;
    url: string;
    city: string;
    neighborhood: string | null;
    propertyType: string | null;
    operationType: string | null;
    priceCop: string;
    areaM2: number;
    areaBuiltM2: number | null;
    areaTerrainM2: number | null;
    pricePerM2: number | null;
  };
  analysis: {
    dealScore: number | null;
    verdict: "good_deal" | "fair" | "overpriced";
    confidence: "high" | "medium" | "low";
    warnings: string[];
    discountVsRefPct: number | null;
    referencePpm2: number | null;
    referencePpm2Nearby?: number | null;
    referencePpm2Neighborhood?: number | null;
    sampleSize: number;
  };
  comps: Array<{
    id: string;
    title: string;
    city: string;
    neighborhood: string | null;
    priceCop: string;
    areaM2: number;
    pricePerM2: number | null;
    distanceMeters: number | null;
    url: string;
  }>;
};

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—";
  return `$ ${Math.round(v).toLocaleString(locale)}`;
}

function labelVerdict(v: AnalyzeResponse["analysis"]["verdict"], txt: (typeof uiText)["es"] | (typeof uiText)["en"]) {
  if (v === "good_deal") return txt.analyzeVerdictGood;
  if (v === "overpriced") return txt.analyzeVerdictOverpriced;
  return txt.analyzeVerdictFair;
}

function confidenceLabel(
  c: AnalyzeResponse["analysis"]["confidence"],
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (c === "high") return txt.confidenceHigh;
  if (c === "medium") return txt.confidenceMedium;
  return txt.confidenceLow;
}

export default function AnalyzeUrlForm() {
  const { lang, toggleLang } = useUiLang("es");
  const txt = uiText[lang];
  const locale = lang === "es" ? "es-CO" : "en-US";

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const opportunitiesHref = useMemo(() => {
    if (!data) return "/opportunities";
    const p = new URLSearchParams();
    p.set("city", data.listing.city);
    if (data.listing.neighborhood) p.set("neighborhood", data.listing.neighborhood);
    if (data.listing.propertyType) p.set("propertyType", data.listing.propertyType);
    return `/opportunities?${p.toString()}`;
  }, [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setData(null);
    if (!url.trim()) {
      setError(txt.analyzeUrlRequired);
      return;
    }
    try {
      const parsed = new URL(url.trim());
      if (!parsed.hostname.includes("fincaraiz.com.co")) {
        setError(txt.analyzeUrlInvalid);
        return;
      }
    } catch {
      setError(txt.analyzeUrlInvalid);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok) {
        const err = j.error ?? "server_error";
        if (err === "url_required") setError(txt.analyzeUrlRequired);
        else if (err === "url_not_allowed" || err === "url_path_invalid") {
          setError(txt.analyzeUrlInvalid);
        } else if (err === "fetch_failed") setError(txt.analyzeFetchFailed);
        else if (err === "price_missing" || err === "area_missing") {
          setError(txt.analyzeParseIncomplete);
        } else setError(txt.analyzeServerError);
        return;
      }
      setData(j);
    } catch {
      setError(txt.analyzeServerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <SiteHeader
        title={txt.analyzeUrlTitle}
        subtitle={txt.analyzeUrlPurpose}
        active="analyzeUrl"
        lang={lang}
        onToggleLang={toggleLang}
        txt={txt}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-8 lg:px-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-card">
            {error}
          </div>
        ) : null}

        <Card className="mb-6 border-slate-200/90 shadow-card">
        <form id="analyze-url-form" onSubmit={(e) => void submit(e)}>
          <label className="block text-xs font-medium text-muted" htmlFor="analyze-url-input">{txt.analyzeUrlInputLabel}</label>
          <input
            id="analyze-url-input"
            type="url"
            required
            className={inputClassName}
            placeholder="https://www.fincaraiz.com.co/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{txt.analyzeUrlExample}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={loading} className="hidden bg-accent py-2.5 text-accent-fg hover:bg-accent-hover disabled:opacity-60 sm:inline-flex">
              {loading ? txt.analyzeUrlLoading : txt.analyzeUrlSubmit}
            </Button>
            <p className="text-xs text-muted">{txt.analyzeUrlHint}</p>
          </div>
        </form>
        </Card>

        {data ? (
          <div className="space-y-6">
            <Card className="border-slate-200/90 shadow-card">
              <h2 className="text-lg font-semibold">{txt.analyzeListingSnapshot}</h2>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted">{txt.listing}:</span> {data.listing.title}</p>
                <p><span className="text-muted">{txt.city}:</span> {data.listing.city}</p>
                <p><span className="text-muted">{txt.neighborhood}:</span> {data.listing.neighborhood ?? txt.unknown}</p>
                <p><span className="text-muted">{txt.type}:</span> {data.listing.propertyType ?? txt.unknown}</p>
                <p><span className="text-muted">{txt.price}:</span> {fmtCop(Number(data.listing.priceCop), locale)}</p>
                <p><span className="text-muted">{txt.pricePerM2}:</span> {fmtCop(data.listing.pricePerM2, locale)}</p>
                <p><span className="text-muted">{txt.estimateArea}:</span> {data.listing.areaM2.toFixed(1)} m²</p>
                <p><span className="text-muted">{txt.opportunitiesMetricBuilt}:</span> {data.listing.areaBuiltM2 != null ? `${data.listing.areaBuiltM2.toFixed(1)} m²` : "—"}</p>
                <p><span className="text-muted">{txt.opportunitiesMetricTerrain}:</span> {data.listing.areaTerrainM2 != null ? `${data.listing.areaTerrainM2.toFixed(1)} m²` : "—"}</p>
              </div>
              <a href={data.listing.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
                {txt.analyzeOpenSource}
              </a>
            </Card>

            <Card className="border-slate-200/90 shadow-card">
              <h2 className="text-lg font-semibold">{txt.analyzeDealAssessment}</h2>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted">{txt.analyzeVerdict}:</span> {labelVerdict(data.analysis.verdict, txt)}</p>
                <p><span className="text-muted">{txt.opportunitiesConfidence}:</span> {confidenceLabel(data.analysis.confidence, txt)}</p>
                <p><span className="text-muted">{txt.dealScore}:</span> {data.analysis.dealScore?.toFixed(2) ?? "—"}</p>
                <p><span className="text-muted">{txt.opportunityDiscount}:</span> {data.analysis.discountVsRefPct != null ? `${data.analysis.discountVsRefPct.toFixed(1)}%` : "—"}</p>
                <p><span className="text-muted">{txt.analyzeReferencePpm2Nearby}:</span> {fmtCop(data.analysis.referencePpm2Nearby ?? data.analysis.referencePpm2, locale)}</p>
                <p><span className="text-muted">{txt.analyzeReferencePpm2Neighborhood}:</span> {fmtCop(data.analysis.referencePpm2Neighborhood, locale)}</p>
                <p><span className="text-muted">{txt.sample}:</span> {data.analysis.sampleSize}</p>
              </div>
              <Button
                href={opportunitiesHref}
                variant="secondary"
                className="mt-4 inline-flex bg-surface px-4 py-2 text-slate-800 shadow-sm hover:bg-slate-100"
              >
                {txt.analyzeFindSimilar}
              </Button>
              {data.analysis.warnings.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {data.analysis.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </Card>

            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-elevated shadow-card">
              <div className="border-b border-slate-200/80 bg-surface/80 px-4 py-3 text-sm font-semibold text-slate-800">
                {txt.analyzeComparableListings}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-600/60">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-700">{txt.listing}</th>
                      <th className="px-4 py-3 font-medium text-slate-700">{txt.neighborhood}</th>
                      <th className="px-4 py-3 font-medium text-slate-700">{txt.distance}</th>
                      <th className="px-4 py-3 font-medium text-slate-700">{txt.price}</th>
                      <th className="px-4 py-3 font-medium text-slate-700">{txt.pricePerM2}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.comps.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-500" colSpan={5}>{txt.analyzeNoComps}</td>
                      </tr>
                    ) : (
                      data.comps.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3">
                            <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                              {c.title}
                            </a>
                          </td>
                          <td className="px-4 py-3">{c.neighborhood ?? txt.unknown}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {c.distanceMeters != null ? `${(c.distanceMeters / 1000).toFixed(2)} km` : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{fmtCop(Number(c.priceCop), locale)}</td>
                          <td className="px-4 py-3 tabular-nums">{fmtCop(c.pricePerM2, locale)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-background/90 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-700/80 sm:hidden">
        <Button
          type="submit"
          form="analyze-url-form"
          disabled={loading}
          className="w-full bg-accent py-3.5 text-accent-fg shadow-lg hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? txt.analyzeUrlLoading : txt.analyzeUrlSubmit}
        </Button>
      </div>
      <PageFooter />
    </div>
  );
}
