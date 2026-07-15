import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ClaraCasas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: { locale: string };
}) {
  const isEn = params.locale === "en";
  const title = isEn
    ? "Real estate data intelligence for Colombia"
    : "Inteligencia inmobiliaria con datos en Colombia";
  const subtitle = isEn
    ? "Price/m² by neighborhood · Finca Raíz data"
    : "Precio/m² por barrio · Datos Finca Raíz";

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
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 28, marginTop: 24, opacity: 0.9 }}>{subtitle}</div>
        <div style={{ fontSize: 36, marginTop: 48, fontWeight: 600 }}>ClaraCasas</div>
      </div>
    ),
    { ...size },
  );
}
