import type { ComponentType } from "react"
import dynamic from "next/dynamic"

import ToolPageFallback from "@/app/components/ToolPageFallback"

/** Code-split tool pages; SSR renders shell/skeletons so first paint is never blank. */
export const loadToolPage = <P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
) =>
  dynamic(loader, {
    loading: () => <ToolPageFallback />,
  })
