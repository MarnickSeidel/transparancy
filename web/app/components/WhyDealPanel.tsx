"use client";

import type { DealFlag, DealScoreBreakdown, WhyDeal } from "@/lib/dealEngine";
import type { Lang } from "@/lib/i18n";
import { uiText } from "@/lib/i18n";

function fmtCop(v: number | null | undefined, locale: string) {
  if (v == null || Number.isNaN(v)) return "—";
  return `$ ${Math.round(v).toLocaleString(locale)}`;
}

function confidenceLabel(
  c: WhyDeal["confidence"] | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (c === "high") return txt.confidenceHigh;
  if (c === "medium") return txt.confidenceMedium;
  if (c === "low") return txt.confidenceLow;
  return "—";
}

function metricTypeLabel(
  t: WhyDeal["metricType"] | undefined,
  txt: (typeof uiText)["es"] | (typeof uiText)["en"],
) {
  if (t === "private") return txt.opportunitiesMetricPrivate;
  if (t === "built") return txt.opportunitiesMetricBuilt;
  if (t === "terrain") return txt.opportunitiesMetricTerrain;
  return txt.opportunitiesMetricGeneric;
}

function compMethodLabel(method: string | undefined, lang: Lang) {
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

type Props = {
  whyDeal: WhyDeal;
  title?: string;
  lang: Lang;
  locale: string;
};

export default function WhyDealPanel({ whyDeal, title, lang, locale }: Props) {
  const txt = uiText[lang];
  const drivers = scoreDrivers(whyDeal.scoreBreakdown, txt);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface/60 px-4 py-3">
      {title ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyCompMethod}</p>
          <p className="mt-0.5 text-sm text-foreground">
            {compMethodLabel(whyDeal.compMethod, lang)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {txt.opportunitiesWhyCompCount}: {whyDeal.compSampleSize}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyDiscount}</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
            {whyDeal.discountPct == null ? "—" : `${whyDeal.discountPct.toFixed(1)}%`}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyMedianComp}</p>
          <p className="mt-0.5 text-sm tabular-nums text-foreground">
            {fmtCop(whyDeal.medianCompPricePerM2, locale)}
          </p>
          <p className="mt-1 text-xs text-muted">{metricTypeLabel(whyDeal.metricType, txt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesConfidence}</p>
          <p className="mt-0.5 text-sm text-foreground">
            {confidenceLabel(whyDeal.confidence, txt)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyFlags}</p>
          {whyDeal.flags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {whyDeal.flags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60"
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
          {whyDeal.confidenceNotes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-foreground">
              {whyDeal.confidenceNotes.map((note) => (
                <li key={note}>{dealNoteLabel(note, txt)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">{txt.opportunitiesWhyNoNotes}</p>
          )}
        </div>
      </div>

      {drivers.length > 0 ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <p className="text-xs font-medium text-muted">{txt.opportunitiesWhyScoreDrivers}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {drivers.map((d) => (
              <span
                key={d.label}
                className={`text-xs tabular-nums ${
                  d.value >= 0 ? "text-deal-good" : "text-deal-bad"
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
