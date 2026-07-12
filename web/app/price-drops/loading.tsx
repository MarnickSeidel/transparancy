import Skeleton from "@/app/components/ui/Skeleton"

export default function PriceDropsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-3 px-4 py-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  )
}
