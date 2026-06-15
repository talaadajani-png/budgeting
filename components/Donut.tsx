"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { colorForIndex } from "@/lib/colors";
import Amount from "./Amount";

export type DonutSlice = { label: string; value: number };

export default function Donut({
  data,
  centerValue,
  centerLabel = "Total balance",
}: {
  data: DonutSlice[];
  centerValue: number;
  centerLabel?: string;
}) {
  const hasData = data.some((d) => d.value > 0);
  const chartData = hasData ? data : [{ label: "No data", value: 1 }];

  return (
    <div className="relative w-full aspect-square max-w-[320px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="label"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={hasData ? 3 : 0}
            cornerRadius={20}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={hasData ? colorForIndex(i) : "#E7E2D6"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1A1A1A]">
          <Amount value={centerValue} compact />
        </span>
        <span className="text-xs text-[#1A1A1A]/50 mt-1">{centerLabel}</span>
      </div>
    </div>
  );
}
