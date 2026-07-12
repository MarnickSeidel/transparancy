const FR_CITY_SLUG: Record<string, string> = {
  Pereira: "pereira",
  Bogota: "bogota",
  Medellin: "medellin",
  Cali: "cali",
  Manizales: "manizales",
};

function slugifyForFr(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Finca Raíz venta/apartamentos search URL for a city + barrio. */
export function buildFincaRaizSearchUrl(city: string, neighborhood: string): string {
  const citySlug = FR_CITY_SLUG[city] ?? slugifyForFr(city);
  const neighborhoodSlug = slugifyForFr(neighborhood);
  return `https://www.fincaraiz.com.co/venta/apartamentos/${citySlug}/${neighborhoodSlug}`;
}
