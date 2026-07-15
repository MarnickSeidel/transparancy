import { ImageResponse } from "next/og";

import { getZoneDossier } from "@/lib/getZoneDossier";
import { DEFAULT_MIN_ZONE_DATA_POINTS } from "@/lib/zones";

export const runtime = "edge";
export const alt = "Zone dossier";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: { locale: string; citySlug: string; zoneSlug: string };
};

export default async function OgImage({ params }: Props) {
  let title = params.zoneSlug;
  let subtitle = params.citySlug;
  let ppm2 = "";

  try {
    const dossier = await getZoneDossier(
      params.citySlug,
      params.zoneSlug,
      DEFAULT_MIN_ZONE_DATA_POINTS,
    );
    if (dossier) {
      title = dossier.displayName;
      subtitle = `${dossier.city}, Colombia`;
      if (dossier.medianPricePerM2 != null) {
        ppm2 = `$${Math.round(dossier.medianPricePerM2).toLocaleString("es-CO")} COP/m²`;
      }
    }
  } catch {
    /* fallback text */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 28, marginTop: 16, opacity: 0.85 }}>{subtitle}</div>
        {ppm2 ? (
          <div style={{ fontSize: 40, marginTop: 32, fontWeight: 600 }}>{ppm2}</div>
        ) : null}
        <div style={{ fontSize: 28, marginTop: 48, opacity: 0.75 }}>ClaraCasas</div>
      </div>
    ),
    { ...size },
  );
}
