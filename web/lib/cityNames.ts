/** Scraped city values drop accents; use this for labels only, never for queries or URLs. */
const CITY_DISPLAY_NAMES: Record<string, string> = {
  bogota: "Bogotá",
  medellin: "Medellín",
  cucuta: "Cúcuta",
  ibague: "Ibagué",
}

export function cityDisplayName(city: string | null | undefined): string {
  if (!city) return ""
  return CITY_DISPLAY_NAMES[city.trim().toLowerCase()] ?? city
}
