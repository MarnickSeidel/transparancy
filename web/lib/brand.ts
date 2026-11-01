export const BRAND_NAME = "LupaCasa" as const

export const BRAND_COLOR = "#EF7B38"

export const BRAND_LOGO = {
  /** Transparent mark — used in header */
  mark: "/branding/casasclaras-mark.svg",
  /** Original PNG — favicon / reference */
  markImage: "/branding/casasclaras-mark.png",
} as const

export const BRAND_COPY = {
  es: {
    defaultTitle: "LupaCasa — Inteligencia inmobiliaria con datos en Colombia",
    homeTitle: "LupaCasa — Detecta propiedades infravaloradas en Colombia",
    toolTitle: "LupaCasa — transparencia del mercado",
    footerTagline: "LupaCasa · Colombia · Datos de publicaciones (no tasación oficial).",
  },
  en: {
    defaultTitle: "LupaCasa — Real estate data intelligence for Colombia",
    homeTitle: "LupaCasa — Spot undervalued property in Colombia",
    toolTitle: "LupaCasa — market transparency",
    footerTagline: "LupaCasa · Colombia · Listing-market data (not an official appraisal).",
  },
} as const
