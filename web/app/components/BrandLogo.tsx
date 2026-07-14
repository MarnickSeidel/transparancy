"use client"

import Image from "next/image"

import { BRAND_LOGO, BRAND_NAME } from "@/lib/brand"

type Props = {
  isDark?: boolean
}

export default function BrandLogo({ isDark = false }: Props) {
  return (
    <span className="inline-flex items-center gap-2.5 sm:gap-3">
      <Image
        src={BRAND_LOGO.mark}
        alt=""
        width={56}
        height={56}
        className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
        priority
        aria-hidden
      />
      <span
        className={`font-sans text-[1.35rem] font-semibold leading-none tracking-[-0.04em] sm:text-[1.5rem] ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {BRAND_NAME}
      </span>
    </span>
  )
}
