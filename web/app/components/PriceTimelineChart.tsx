"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PriceTimelinePoint = {
  recordedAt: string;
  priceCop: number;
};

function formatCompactCop(n: number, locale: string) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return Math.round(n).toLocaleString(locale);
}

function formatDateLabel(iso: string, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export default function PriceTimelineChart({
  points,
  locale,
  noDataLabel,
  tooltipLabel,
  compact = false,
}: {
  points: PriceTimelinePoint[];
  locale: string;
  noDataLabel: string;
  tooltipLabel: string;
  compact?: boolean;
}) {
  const data = [...points]
    .filter((p) => Number.isFinite(p.priceCop) && p.priceCop > 0)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((p) => ({
      date: formatDateLabel(p.recordedAt, locale),
      price: p.priceCop,
      recordedAt: p.recordedAt,
    }));

  if (data.length < 2) {
    const only = data[0]
    return (
      <p className={`text-center text-muted ${compact ? "py-3 text-xs" : "px-4 py-6 text-sm"}`}>
        {only
          ? `$ ${Math.round(only.price).toLocaleString(locale)} · ${only.date}`
          : noDataLabel}
      </p>
    )
  }

  const height = compact ? 100 : 240;

  return (
    <div className={`w-full ${compact ? "px-1 pb-1 pt-2" : "px-2 pb-2 pt-4"}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: compact ? 9 : 11 }}
            className="fill-muted"
            tickLine={false}
            axisLine={false}
            interval={compact ? "preserveStartEnd" : undefined}
          />
          <YAxis
            tick={{ fontSize: compact ? 9 : 11 }}
            className="fill-muted"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCompactCop(Number(v), locale)}
            width={compact ? 40 : 52}
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              return [
                Number.isFinite(n)
                  ? `$ ${Math.round(n).toLocaleString(locale)}`
                  : "—",
                tooltipLabel,
              ];
            }}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.recordedAt as string | undefined;
              if (!raw) return "";
              const d = new Date(raw);
              return d.toLocaleString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--border, #e2e8f0)",
              fontSize: compact ? "11px" : "13px",
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--color-accent, #0d9488)"
            strokeWidth={compact ? 2 : 2.5}
            dot={compact ? false : { fill: "#0d9488", strokeWidth: 0, r: 3 }}
            activeDot={{ r: compact ? 4 : 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
