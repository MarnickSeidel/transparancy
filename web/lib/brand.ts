export const BRAND_NAME = "ClaraCasas" as const

export const BRAND_COLOR = "#EF7B38"

export const BRAND_LOGO = {
  /** Transparent mark — used in header */
  mark: "/branding/claracasas-mark.svg",
  /** Original PNG — favicon / reference */
  markImage: "/branding/claracasas-mark.png",
} as const

export const BRAND_COPY = {
  es: {
    defaultTitle: "ClaraCasas — Inteligencia inmobiliaria con datos en Colombia",
    homeTitle: "ClaraCasas — Detecta propiedades infravaloradas en Colombia",
    toolTitle: "ClaraCasas — transparencia del mercado",
    footerTagline: "ClaraCasas · Colombia · Datos de publicaciones (no tasación oficial).",
  },
  en: {
    defaultTitle: "ClaraCasas — Real estate data intelligence for Colombia",
    homeTitle: "ClaraCasas — Spot undervalued property in Colombia",
    toolTitle: "ClaraCasas — market transparency",
    footerTagline: "ClaraCasas · Colombia · Listing-market data (not an official appraisal).",
  },
} as const
