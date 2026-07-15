import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "ClaraCasas opportunities"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpportunitiesOgImage() {
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
          background: "linear-gradient(135deg, #c45c26 0%, #1a2332 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>
          Oportunidades inmobiliarias
        </div>
        <div style={{ fontSize: 28, marginTop: 24, opacity: 0.92 }}>
          Descuentos vs mediana del barrio · Finca Raíz
        </div>
        <div style={{ fontSize: 36, marginTop: 48, fontWeight: 600 }}>ClaraCasas</div>
      </div>
    ),
    { ...size },
  )
}
