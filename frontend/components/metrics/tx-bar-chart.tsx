"use client";

// Extracted so recharts can be lazy-loaded (next/dynamic) from the metrics page,
// keeping it out of that page's initial bundle.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { useReducedMotion } from "framer-motion";

// Single series → white (the primary). If more series are ever added, they must
// be distinguished by line/dash style + direct labels, never by shades of grey.
const BAR = "hsl(0 0% 90%)";

interface DayBucket {
  day: string;
  count: number;
}

function TxTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-card/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{payload[0].value} tx</p>
    </div>
  );
}

export default function TxBarChart({ data }: { data: DayBucket[] }) {
  const reduce = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 14, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<TxTooltip />} cursor={{ fill: "hsl(0 0% 100% / 0.05)" }} />
        <Bar
          dataKey="count"
          fill={BAR}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          isAnimationActive={!reduce}
        >
          {/* Direct value labels — readability without relying on colour. */}
          <LabelList
            dataKey="count"
            position="top"
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
            formatter={(v: number) => (v > 0 ? v : "")}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
