export const BRAND_NAME = "CasasClaras" as const

export const BRAND_COLOR = "#EF7B38"

export const BRAND_LOGO = {
  /** Transparent mark — used in header */
  mark: "/branding/casasclaras-mark.svg",
  /** Original PNG — favicon / reference */
  markImage: "/branding/casasclaras-mark.png",
} as const

export const BRAND_COPY = {
  es: {
    defaultTitle: "CasasClaras — Inteligencia inmobiliaria con datos en Colombia",
    homeTitle: "CasasClaras — Detecta propiedades infravaloradas en Colombia",
    toolTitle: "CasasClaras — transparencia del mercado",
    footerTagline: "CasasClaras · Colombia · Datos de publicaciones (no tasación oficial).",
  },
  en: {
    defaultTitle: "CasasClaras — Real estate data intelligence for Colombia",
    homeTitle: "CasasClaras — Spot undervalued property in Colombia",
    toolTitle: "CasasClaras — market transparency",
    footerTagline: "CasasClaras · Colombia · Listing-market data (not an official appraisal).",
  },
} as const
