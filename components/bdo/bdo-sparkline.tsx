"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";

export function BdoSparkline({
  data,
  positive,
}: {
  data: number[];
  positive: boolean;
}) {
  const pts = data.map((v, i) => ({ i, v }));
  const stroke = positive ? "var(--chart-2)" : "var(--chart-5)";

  return (
    <div className="h-full min-h-[44px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={44}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bdoSpark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.25}
          fill="url(#bdoSpark)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
