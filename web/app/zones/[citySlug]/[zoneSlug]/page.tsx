import { notFound } from "next/navigation";

import ZoneDossier from "@/app/components/ZoneDossier";
import { getZoneDossier } from "@/lib/getZoneDossier";
import { zoneJsonLd, zonePageMetadata } from "@/lib/zoneSeo";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export const revalidate = 300;

type Props = {
  params: { citySlug: string; zoneSlug: string };
};

export async function generateMetadata({ params }: Props) {
  try {
    const dossier = await getZoneDossier(
      params.citySlug,
      params.zoneSlug,
      DEFAULT_MIN_ZONE_DATA_POINTS,
    );
    if (!dossier) {
      return { title: "Barrio no encontrado" };
    }
    return zonePageMetadata(dossier);
  } catch {
    return { title: "Dossier de barrio" };
  }
}

export default async function ZoneDetailPage({ params }: Props) {
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

  if (!dossier) notFound();

  const jsonLd = zoneJsonLd(dossier);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ZoneDossier
        citySlug={params.citySlug}
        zoneSlug={params.zoneSlug}
        initialData={dossier}
      />
    </>
  );
}
