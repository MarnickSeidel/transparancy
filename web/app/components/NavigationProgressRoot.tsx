"use client"

import { Suspense } from "react"

import NavigationProgress from "@/app/components/NavigationProgress"

/** Suspense boundary required because NavigationProgress reads searchParams. */
export default function NavigationProgressRoot() {
  return (
    <Suspense fallback={null}>
      <NavigationProgress />
    </Suspense>
  )
}
