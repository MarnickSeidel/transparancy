export function normalizeNeighborhoodKey(input: string): string {
  const noAccents = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const withoutAddressTokens = noAccents.replace(
    /\b(calle|carrera|cra|cr|cll|cl|apto|apt|apartamento)\b/g,
    " ",
  );
  return withoutAddressTokens
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
