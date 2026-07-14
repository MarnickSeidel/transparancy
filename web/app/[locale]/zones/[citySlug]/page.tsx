import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Breadcrumbs from "@/app/components/Breadcrumbs";
import PageFooter from "@/app/components/PageFooter";
import Card from "@/app/components/ui/Card";
import { cityHubJsonLd, cityHubMetadata } from "@/lib/citySeo";
import { getCityFromSlug } from "@/lib/getCityFromSlug";
import { getZonesForCity } from "@/lib/getZonesIndex";
import { cityIntroParagraph } from "@/lib/zoneCopy";
import { breadcrumbJsonLd } from "@/lib/trustSeo";
import { localePath, type Locale, LOCALES } from "@/lib/locale";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export const revalidate = 300;

type Props = { params: { locale: string; citySlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale as Locale;
  const city = await getCityFromSlug(params.citySlug);
  if (!city) return { title: locale === "en" ? "City not found" : "Ciudad no encontrada" };
  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  return cityHubMetadata(city, params.citySlug, data.zones.length, locale);
}

function fmtCop(v: number | null, locale: Locale) {
  if (v == null) return "—";
  const loc = locale === "es" ? "es-CO" : "en-US";
  return `$ ${Math.round(v).toLocaleString(loc)}`;
}

export default async function CityHubPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  const city = await getCityFromSlug(params.citySlug);
  if (!city) notFound();

  const data = await getZonesForCity(city, DEFAULT_MIN_ZONE_DATA_POINTS);
  const lp = (path: string) => localePath(locale, path);
  const intro = cityIntroParagraph(city, data.zones.length, locale);

  const crumbs = [
    { label: locale === "en" ? "Home" : "Inicio", href: lp("/") },
    { label: locale === "en" ? "Neighborhoods" : "Barrios", href: lp("/zones") },
    { label: city, href: lp(`/zones/${params.citySlug}`) },
  ];

  const jsonLd = [
    cityHubJsonLd(city, params.citySlug, data.zones, locale),
    breadcrumbJsonLd(
      [
        { name: locale === "en" ? "Home" : "Inicio", path: "/" },
        { name: locale === "en" ? "Neighborhoods" : "Barrios", path: "/zones" },
        { name: city, path: `/zones/${params.citySlug}` },
      ],
      locale,
    ),
  ];

  const h1 =
    locale === "en"
      ? `${city} neighborhoods — price per m²`
      : `Barrios en ${city} — precio m²`;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <header className="border-b border-slate-200/40 bg-background/80 px-4 py-6 dark:border-slate-700/50 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Link href={lp("/")} className="text-sm font-semibold text-accent hover:underline">
            Habidata
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">{h1}</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">{intro}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={crumbs} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.zones.map((z) => (
            <Link
              key={z.slug}
              href={lp(`/zones/${params.citySlug}/${z.slug}`)}
              className="block rounded-2xl border border-slate-200/90 bg-elevated p-5 transition hover:border-teal-300 dark:border-slate-700/80"
            >
              <p className="font-semibold text-foreground">{z.displayName}</p>
              <p className="mt-2 text-sm text-muted">
                {z.listingCount.toLocaleString(locale === "es" ? "es-CO" : "en-US")}{" "}
                {locale === "en" ? "active listings" : "publicaciones activas"}
              </p>
              {z.medianPricePerM2 != null ? (
                <p className="mt-2 text-sm font-semibold tabular-nums text-accent">
                  {locale === "en" ? "Median / m²" : "Mediana / m²"}:{" "}
                  {fmtCop(z.medianPricePerM2, locale)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
        {data.zones.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              {locale === "en" ? "No published neighborhoods yet." : "Aún no hay barrios publicados."}
            </p>
          </Card>
        ) : null}
      </main>
      <PageFooter />
    </div>
  );
}
