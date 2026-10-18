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

type Row = {
  month: string;
  medianPpm2: number | null;
};

function formatCompactCop(n: number, locale: string) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return Math.round(n).toLocaleString(locale);
}

export default function MonthlyTrendChart({
  rows,
  locale,
  noDataLabel,
  tooltipLabel,
}: {
  rows: Row[];
  locale: string;
  noDataLabel: string;
  tooltipLabel: string;
}) {
  const data = rows
    .filter((r) => r.medianPpm2 != null)
    .map((r) => ({
      month: r.month,
      median: r.medianPpm2 as number,
    }));

  if (data.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">{noDataLabel}</p>
    );
  }

  const values = data.map((d) => d.median);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, max * 0.05);
  const yDomain: [number, number] = [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];

  return (
    <div className="h-[280px] w-full px-2 pb-2 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            tickFormatter={(v) => formatCompactCop(Number(v), locale)}
            domain={yDomain}
            width={48}
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
            labelFormatter={(label) => label}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
            }}
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke="#0d9488"
            strokeWidth={2.5}
            dot={{ fill: "#0d9488", strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
