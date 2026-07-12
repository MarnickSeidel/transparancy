import type { Lang } from "@/lib/i18n"
import { uiText } from "@/lib/i18n"

export function dealWarningLabel(
  note: string,
  lang: Lang,
): string {
  const txt = uiText[lang]
  const key = `dealNote_${note}` as keyof typeof txt
  const fromNote = txt[key] as string | undefined
  if (fromNote) return fromNote
  const flagKey = `dealFlag_${note}` as keyof typeof txt
  const fromFlag = txt[flagKey] as string | undefined
  if (fromFlag) return fromFlag
  return note.replace(/_/g, " ")
}
