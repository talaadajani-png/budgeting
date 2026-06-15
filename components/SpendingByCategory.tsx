"use client";

import { useMemo, useState } from "react";
import Donut, { type DonutSlice } from "./Donut";
import Amount from "./Amount";
import BoxToggle from "./BoxToggle";
import { colorForIndex } from "@/lib/colors";
import { prettyCategory } from "@/lib/format";
import { PrivacyContext, useBoxPrivacy } from "@/lib/privacy";
import type { Transaction } from "@/lib/types";

type Period = "week" | "month";

function inMonth(dateStr: string): boolean {
  const [y, m] = dateStr.split("-").map(Number);
  const now = new Date();
  return y === now.getFullYear() && m - 1 === now.getMonth();
}

function inWeek(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 6);
  return date >= weekAgo && date <= now;
}

export default function SpendingByCategory({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [period, setPeriod] = useState<Period>("month");
  const { hidden, toggle } = useBoxPrivacy();

  const slices = useMemo<DonutSlice[]>(() => {
    const inPeriod = period === "week" ? inWeek : inMonth;
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount <= 0 || !inPeriod(t.date)) continue; // money out only
      const key = prettyCategory(t.category);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, period]);

  const total = useMemo(() => slices.reduce((s, x) => s + x.value, 0), [slices]);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      <div className="bg-[#FBF9F4] rounded-3xl p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h2 className="font-semibold">Spending by category</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white/60 rounded-full p-1">
              {(["week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    period === p ? "bg-[#1A1A1A] text-white" : "text-[#1A1A1A]/60"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <BoxToggle hidden={hidden} onToggle={toggle} />
          </div>
        </div>

        <Donut
          data={slices}
          centerValue={total}
          centerLabel={period === "week" ? "Spent this week" : "Spent this month"}
        />

        <div className="mt-4 flex flex-col gap-2">
          {slices.length === 0 ? (
            <p className="text-sm text-[#1A1A1A]/40 text-center py-2">
              No spending in this period.
            </p>
          ) : (
            slices.map((s, i) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: colorForIndex(i) }}
                  />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="font-medium">
                  <Amount value={s.value} />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </PrivacyContext.Provider>
  );
}
