/** Escape user/scraped strings before HTML interpolation (email templates, etc.). */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

/** Escape and sanitize URLs used in href attributes. */
export const escapeHtmlAttr = (value: string): string => escapeHtml(value)
