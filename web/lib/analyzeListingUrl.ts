import {
  fetchHtmlWithTimeout,
  parseSingleListingFromHtml,
  validateFincaraizUrl,
  type ParsedListing,
} from "@/lib/fincaraizSingleListing"
import {
  isMetrocuadradoHost,
  parseMetrocuadradoListingFromHtml,
  validateMetrocuadradoUrl,
} from "@/lib/metrocuadradoSingleListing"

export type AnalyzeListingSource = "fincaraiz" | "metrocuadrado"

export const detectAnalyzeListingSource = (
  input: string,
): AnalyzeListingSource | null => {
  try {
    const host = new URL(input.trim()).hostname.toLowerCase()
    if (host === "fincaraiz.com.co" || host === "www.fincaraiz.com.co") {
      return "fincaraiz"
    }
    if (isMetrocuadradoHost(host)) return "metrocuadrado"
    return null
  } catch {
    return null
  }
}

export const isAllowedAnalyzeListingHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase()
  return (
    host === "fincaraiz.com.co" ||
    host === "www.fincaraiz.com.co" ||
    isMetrocuadradoHost(host)
  )
}

/** Canonical listing URL for an allowed portal, or throws url_* errors. */
export const validateAnalyzeListingUrl = (input: string): string => {
  const source = detectAnalyzeListingSource(input)
  if (source === "fincaraiz") return validateFincaraizUrl(input)
  if (source === "metrocuadrado") return validateMetrocuadradoUrl(input)
  throw new Error("url_not_allowed")
}

export const fetchAndParseAnalyzeListing = async (
  input: string,
  timeoutMs = 15000,
): Promise<ParsedListing> => {
  const source = detectAnalyzeListingSource(input)
  if (!source) throw new Error("url_not_allowed")

  const canonical =
    source === "fincaraiz"
      ? validateFincaraizUrl(input)
      : validateMetrocuadradoUrl(input)

  const html = await fetchHtmlWithTimeout(canonical, timeoutMs)
  if (source === "fincaraiz") {
    return parseSingleListingFromHtml(canonical, html)
  }
  return parseMetrocuadradoListingFromHtml(canonical, html)
}
