export const TOOL_PREFIXES = [
  "/dashboard",
  "/explore",
  "/heatmap",
  "/estimate",
  "/analyze-url",
  "/price-drops",
] as const

export function isToolPath(pathname: string): boolean {
  const path = pathname.split("?")[0]
  return TOOL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

export function isEnToolPath(pathname: string): boolean {
  const path = pathname.split("?")[0]
  if (!path.startsWith("/en/")) return false
  return isToolPath(path.slice(3) || "/")
}
