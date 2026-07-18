"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const isInternalNavHref = (href: string | null, currentOrigin: string) => {
  if (!href) return false
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false
  }
  if (href.startsWith("/")) return true
  try {
    const url = new URL(href, currentOrigin)
    return url.origin === currentOrigin
  } catch {
    return false
  }
}

const sameDestination = (href: string, origin: string, path: string, search: string) => {
  try {
    const url = new URL(href, origin)
    return url.pathname === path && url.search === search
  } catch {
    return false
  }
}

/**
 * Instant visual feedback on soft navigations.
 * Shows a top progress bar within one frame of pointerdown,
 * even when the destination RSC payload is still loading.
 */
export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearSafetyTimer = () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
    }

    const stop = () => {
      clearSafetyTimer()
      activeRef.current = false
      setActive(false)
      document.documentElement.removeAttribute("data-nav-pending")
    }

    const start = () => {
      if (activeRef.current) return
      activeRef.current = true
      setActive(true)
      document.documentElement.setAttribute("data-nav-pending", "true")
      clearSafetyTimer()
      safetyTimerRef.current = setTimeout(stop, 12000)
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as Element | null
      const anchor = target?.closest?.("a")
      if (!anchor) return
      if (anchor.getAttribute("download") != null) return
      if (anchor.target && anchor.target !== "_self") return

      const href = anchor.getAttribute("href")
      if (!isInternalNavHref(href, window.location.origin)) return
      if (
        sameDestination(
          href!,
          window.location.origin,
          window.location.pathname,
          window.location.search,
        )
      ) {
        return
      }

      start()
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      clearSafetyTimer()
      document.documentElement.removeAttribute("data-nav-pending")
    }
  }, [])

  useEffect(() => {
    if (!activeRef.current && !safetyTimerRef.current) return
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
    activeRef.current = false
    setActive(false)
    document.documentElement.removeAttribute("data-nav-pending")
  }, [pathname, searchParams])

  return (
    <div
      className={`nav-progress${active ? " nav-progress--active" : ""}`}
      role="progressbar"
      aria-hidden={!active}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={active ? "Loading" : undefined}
    />
  )
}
