"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ACCENTS } from "@/lib/colors";
import { formatCurrency } from "@/lib/format";
import { PrivacyContext, useBoxPrivacy } from "@/lib/privacy";
import Amount from "./Amount";
import BoxToggle from "./BoxToggle";
import type { Transaction } from "@/lib/types";

type Mode = "daily" | "weekly";

// Parse a "YYYY-MM-DD" string as a local calendar date (avoids UTC day shifts).
function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function keyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type Bucket = { label: string; value: number };

function buildDaily(transactions: Transaction[]): Bucket[] {
  const today = new Date();
  const buckets: (Bucket & { key: string })[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.push({ key: keyOf(d), label: `${d.getMonth() + 1}/${d.getDate()}`, value: 0 });
  }
  const map = new Map(buckets.map((b) => [b.key, b]));
  for (const t of transactions) {
    if (t.amount <= 0) continue; // money out only
    const b = map.get(t.date);
    if (b) b.value += t.amount;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

function buildWeekly(transactions: Transaction[]): Bucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: (Bucket & { start: Date; end: Date })[] = [];
  for (let w = 7; w >= 0; w--) {
    const end = new Date(today);
    end.setDate(today.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    buckets.push({
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      value: 0,
      start,
      end,
    });
  }
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    const d = parseLocal(t.date);
    for (const b of buckets) {
      if (d >= b.start && d <= b.end) {
        b.value += t.amount;
        break;
      }
    }
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export default function SpendingChart({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [mode, setMode] = useState<Mode>("daily");
  const { hidden, toggle } = useBoxPrivacy();

  const data = useMemo(
    () => (mode === "daily" ? buildDaily(transactions) : buildWeekly(transactions)),
    [transactions, mode]
  );

  const { spentToday, spentThisWeek } = useMemo(() => {
    const today = new Date();
    const todayKey = keyOf(today);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    let day = 0;
    let week = 0;
    for (const t of transactions) {
      if (t.amount <= 0) continue;
      if (t.date === todayKey) day += t.amount;
      if (parseLocal(t.date) >= weekAgo) week += t.amount;
    }
    return { spentToday: day, spentThisWeek: week };
  }, [transactions]);

  const maxLen = data.length;

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
    <div className="bg-[#FBF9F4] rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-[#1A1A1A]/50">Spent today</div>
            <div className="text-xl font-bold">
              <Amount value={spentToday} />
            </div>
          </div>
          <div>
            <div className="text-xs text-[#1A1A1A]/50">Spent this week</div>
            <div className="text-xl font-bold">
              <Amount value={spentThisWeek} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/60 rounded-full p-1">
            {(["daily", "weekly"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                  mode === m ? "bg-[#1A1A1A] text-white" : "text-[#1A1A1A]/60"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <BoxToggle hidden={hidden} onToggle={toggle} />
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#1A1A1A80" }}
              axisLine={false}
              tickLine={false}
              interval={maxLen > 10 ? 1 : 0}
            />
            <Tooltip
              cursor={{ fill: "#1A1A1A0A" }}
              formatter={(value) =>
                [hidden ? "••••" : formatCurrency(Number(value)), "Spent"] as [string, string]
              }
              contentStyle={{
                borderRadius: 12,
                border: "none",
                backgroundColor: "#1A1A1A",
                color: "#fff",
                fontSize: 12,
              }}
              labelStyle={{ color: "#ffffff99" }}
            />
            <Bar dataKey="value" radius={[8, 8, 8, 8]} maxBarSize={28}>
              {data.map((_, i) => (
                <Cell key={i} fill={ACCENTS.blue} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-[#1A1A1A]/40 mt-2">
        {mode === "daily" ? "Last 14 days" : "Last 8 weeks"} · money out
      </div>
    </div>
    </PrivacyContext.Provider>
  );
}
