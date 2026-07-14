"use client"

import Image from "next/image"

type Props = {
  src: string
  width: number
  height: number
  className?: string
  sizes?: string
}

export default function ListingThumbnail({
  src,
  width,
  height,
  className = "h-full w-full object-cover",
  sizes,
}: Props) {
  return (
    <Image
      src={src}
      alt=""
      width={width}
      height={height}
      className={className}
      loading="lazy"
      sizes={sizes}
    />
  )
}
