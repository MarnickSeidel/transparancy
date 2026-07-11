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

/** Pick the filter dropdown label that matches a URL or dossier neighborhood param. */
export function resolveNeighborhoodLabel(
  param: string,
  options: string[],
): string {
  const trimmed = param.trim();
  if (!trimmed || trimmed === "all") return "all";
  if (options.includes(trimmed)) return trimmed;
  const key = normalizeNeighborhoodKey(trimmed);
  if (!key) return trimmed;
  return options.find((o) => normalizeNeighborhoodKey(o) === key) ?? trimmed;
}
