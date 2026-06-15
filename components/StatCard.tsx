"use client";

import Amount from "./Amount";
import BoxToggle from "./BoxToggle";
import { PrivacyContext, useBoxPrivacy } from "@/lib/privacy";

export default function StatCard({
  label,
  value,
  subtitle,
  delta,
  color,
  icon,
}: {
  label: string;
  value: number;
  subtitle?: React.ReactNode;
  delta?: number; // percentage change, optional
  color: string; // pastel background
  icon?: React.ReactNode;
}) {
  const { hidden, toggle } = useBoxPrivacy();
  const up = (delta ?? 0) >= 0;
  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      <div
        className="rounded-3xl p-5 flex flex-col gap-2"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#1A1A1A]/80">
            {icon}
            <span className="font-medium text-sm">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            {typeof delta === "number" && (
              <span className="flex items-center gap-1 bg-white/70 rounded-full px-2 py-0.5 text-xs font-medium text-[#1A1A1A]">
                {up ? "↑" : "↓"} {up ? "+" : ""}
                {delta}%
              </span>
            )}
            <BoxToggle hidden={hidden} onToggle={toggle} />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight text-[#1A1A1A]">
          <Amount value={value} />
        </div>
        {subtitle && <div className="text-xs text-[#1A1A1A]/50">{subtitle}</div>}
      </div>
    </PrivacyContext.Provider>
  );
}
