const fs = require("fs")
const path = require("path")

const src = fs.readFileSync(path.join("lib", "i18n.ts"), "utf8")
const esMatch = src.match(/es: (\{[\s\S]*?\n  \}),\n  en:/)
const enMatch = src.match(/en: (\{[\s\S]*?\n  \}),\n\} as const;/)
const priorityMatch = src.match(/export const priorityCities = [\s\S]*?];/)

if (!esMatch || !enMatch || !priorityMatch) {
  console.error("parse failed")
  process.exit(1)
}

const dir = path.join("lib", "i18n")
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, "types.ts"), 'export type Lang = "es" | "en";\n')
fs.writeFileSync(path.join(dir, "shared.ts"), `${priorityMatch[0]}\n`)
fs.writeFileSync(
  path.join(dir, "es.ts"),
  `export const uiTextEs = ${esMatch[1]} as const\n`,
)
fs.writeFileSync(
  path.join(dir, "en.ts"),
  `export const uiTextEn = ${enMatch[1]} as const\n`,
)
fs.writeFileSync(
  path.join(dir, "index.ts"),
  `export type { Lang } from "./types"
export { priorityCities } from "./shared"
import { uiTextEs } from "./es"
import { uiTextEn } from "./en"
import type { Lang } from "./types"

export const uiText = { es: uiTextEs, en: uiTextEn } as const

export const getUiText = (lang: Lang) => (lang === "es" ? uiTextEs : uiTextEn)
`,
)
fs.writeFileSync(
  path.join("lib", "i18n.ts"),
  `export type { Lang } from "./i18n/types"
export { priorityCities, uiText, getUiText } from "./i18n/index"
`,
)
console.log("i18n split ok")
