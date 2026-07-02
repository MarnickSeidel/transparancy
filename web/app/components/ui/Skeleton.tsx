type Props = {
  className?: string;
};

export default function Skeleton({ className }: Props) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-200/90 via-slate-100/90 to-slate-200/90 bg-[length:200%_100%] dark:from-slate-700/90 dark:via-slate-600/80 dark:to-slate-700/90 ${className ?? ""}`}
      aria-hidden
    />
  );
}
