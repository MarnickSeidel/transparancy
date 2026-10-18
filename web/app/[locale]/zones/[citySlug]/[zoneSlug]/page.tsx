import { notFound, permanentRedirect } from "next/navigation";

import ZoneDossier from "@/app/components/ZoneDossier";
import { getRelatedZones } from "@/lib/getRelatedZones";
import { getMovedZoneSlug, getZoneDossier } from "@/lib/getZoneDossier";
import { ZONE_NEARBY_RADIUS_M } from "@/lib/nearbyAmenities";
import { getCachedNearbyAmenities } from "@/lib/serverCache";
import { breadcrumbJsonLd } from "@/lib/trustSeo";
import { LOCALES, localePath, stripLocalePrefix, type Locale } from "@/lib/locale";
import { zoneIntroParagraphs } from "@/lib/zoneCopy";
import {
  zoneBreadcrumbItems,
  zoneJsonLd,
  zonePageMetadata,
} from "@/lib/zoneSeo";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export const revalidate = 300;

type Props = {
  params: { locale: string; citySlug: string; zoneSlug: string };
};

export async function generateMetadata({ params }: Props) {
  const locale = params.locale as Locale;
  try {
    const dossier = await getZoneDossier(
      params.citySlug,
      params.zoneSlug,
      DEFAULT_MIN_ZONE_DATA_POINTS,
    );
    if (!dossier) {
      return { title: locale === "en" ? "Neighborhood not found" : "Barrio no encontrado" };
    }
    return zonePageMetadata(dossier, locale);
  } catch {
    return { title: locale === "en" ? "Neighborhood dossier" : "Dossier de barrio" };
  }
}

export default async function ZoneDetailPage({ params }: Props) {
  const locale = params.locale as Locale;
  if (!LOCALES.includes(locale)) notFound();

  let dossier;
  try {
    dossier = await getZoneDossier(
      params.citySlug,
      params.zoneSlug,
      DEFAULT_MIN_ZONE_DATA_POINTS,
    );
  } catch {
    notFound();
  }

  if (!dossier?.published) {
    const moved = await getMovedZoneSlug(params.citySlug, params.zoneSlug).catch(() => null);
    if (moved) {
      permanentRedirect(localePath(locale, `/zones/${params.citySlug}/${moved}`));
    }
  }

  if (!dossier) notFound();

  const relatedZones = dossier.published
    ? await getRelatedZones(dossier.city, dossier.slug)
    : [];

  const introParagraphs = zoneIntroParagraphs(dossier, locale);
  const breadcrumbItems = zoneBreadcrumbItems(dossier, locale);

  const initialNearby =
    dossier.geoListingCount >= 3 &&
    dossier.centroidLatitude != null &&
    dossier.centroidLongitude != null
      ? await getCachedNearbyAmenities(
          dossier.centroidLatitude,
          dossier.centroidLongitude,
          ZONE_NEARBY_RADIUS_M,
        ).catch(() => null)
      : null;

  const jsonLd = [
    zoneJsonLd(dossier, locale),
    breadcrumbJsonLd(
      breadcrumbItems.map((b) => ({
        name: b.label,
        path: stripLocalePrefix(b.href),
      })),
      locale,
    ),
  ];

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ZoneDossier
        citySlug={params.citySlug}
        zoneSlug={params.zoneSlug}
        locale={locale}
        initialData={dossier}
        initialNearby={initialNearby}
        introParagraphs={introParagraphs}
        breadcrumbItems={breadcrumbItems}
        relatedZones={relatedZones}
      />
    </>
  );
}
