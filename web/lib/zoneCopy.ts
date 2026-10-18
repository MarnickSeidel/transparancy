import type { Locale } from "@/lib/locale";
import type { ZoneDossier } from "@/lib/zones";

/** Indicative COP→USD rate for US investors (not live FX). */
export const INDICATIVE_USD_RATE = 4000;

function fmtCop(v: number, locale: Locale): string {
  const loc = locale === "es" ? "es-CO" : "en-US";
  return `$${Math.round(v).toLocaleString(loc)}`;
}

function fmtUsdFromCop(cop: number): string {
  return `$${Math.round(cop / INDICATIVE_USD_RATE).toLocaleString("en-US")}`;
}

export function zoneTrendPhrase(
  dossier: Pick<ZoneDossier, "monthlyTrend">,
  locale: Locale,
): string | null {
  const rows = dossier.monthlyTrend.filter((r) => r.medianPpm2 != null);
  if (rows.length < 2) return null;
  const first = rows[0].medianPpm2!;
  const last = rows[rows.length - 1].medianPpm2!;
  const pct = ((last - first) / first) * 100;
  if (Math.abs(pct) < 0.5) {
    return locale === "es"
      ? "Los precios se han mantenido estables en los últimos meses."
      : "Prices have remained relatively stable over recent months.";
  }
  const dir = pct > 0 ? (locale === "es" ? "subió" : "rose") : locale === "es" ? "bajó" : "fell";
  const abs = Math.abs(pct).toFixed(1);
  return locale === "es"
    ? `La mediana de precio/m² ${dir} aproximadamente ${abs}% en el periodo analizado.`
    : `Median price per m² ${dir} approximately ${abs}% over the analyzed period.`;
}

export function zoneIntroParagraphs(dossier: ZoneDossier, locale: Locale): string[] {
  const { displayName, city, listingCount, dataPointCount, medianPricePerM2 } = dossier;
  const paragraphs: string[] = [];

  if (locale === "es") {
    paragraphs.push(
      `${displayName} es un barrio en ${city}, Colombia, con ${listingCount.toLocaleString("es-CO")} publicaciones activas analizadas en CasasClaras. Los datos provienen de anuncios de Finca Raíz y se actualizan periódicamente.`,
    );
    if (medianPricePerM2 != null) {
      paragraphs.push(
        `La mediana de precio por metro cuadrado en ${displayName} es ${fmtCop(medianPricePerM2, locale)}, calculada a partir de ${dataPointCount.toLocaleString("es-CO")} anuncios con precio/m² disponible.`,
      );
    }
    const trend = zoneTrendPhrase(dossier, locale);
    if (trend) paragraphs.push(trend);
  } else {
    paragraphs.push(
      `${displayName} is a neighborhood in ${city}, Colombia, with ${listingCount.toLocaleString("en-US")} active listings tracked on CasasClaras. Data is sourced from Finca Raíz listings and updated on a rolling basis — useful for US and international investors researching Colombian real estate markets.`,
    );
    if (medianPricePerM2 != null) {
      const usd = fmtUsdFromCop(medianPricePerM2);
      paragraphs.push(
        `The median asking price per square meter in ${displayName} is ${fmtCop(medianPricePerM2, locale)} COP (~${usd}/m² USD at an indicative rate of ${INDICATIVE_USD_RATE} COP/USD), based on ${dataPointCount.toLocaleString("en-US")} listings with price/m² data. This is not an appraisal — it reflects published asking prices.`,
      );
    }
    const trend = zoneTrendPhrase(dossier, locale);
    if (trend) paragraphs.push(trend);
  }

  return paragraphs;
}

export function cityIntroParagraph(
  city: string,
  zoneCount: number,
  locale: Locale,
): string {
  if (locale === "es") {
    return `${city} cuenta con ${zoneCount} barrios con datos suficientes en CasasClaras. Explora la mediana de precio por m², publicaciones activas y tendencias de cada zona.`;
  }
  return `${city} has ${zoneCount} neighborhoods with sufficient listing data on CasasClaras. Explore median price per m², active listings, and monthly trends for each barrio — a practical starting point for US investors evaluating ${city}.`;
}
