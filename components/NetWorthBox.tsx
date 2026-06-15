"use client";

import Amount from "./Amount";
import BoxToggle from "./BoxToggle";
import { ACCENTS } from "@/lib/colors";
import { PrivacyContext, useBoxPrivacy } from "@/lib/privacy";
import type { Balances } from "@/lib/finance";

export default function NetWorthBox({ balances }: { balances: Balances }) {
  const { hidden, toggle } = useBoxPrivacy();
  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      <div className="bg-[#FBF9F4] rounded-3xl p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-[#1A1A1A]/50">Net worth</span>
          <BoxToggle hidden={hidden} onToggle={toggle} />
        </div>
        <div className="text-2xl font-bold tracking-tight">
          <Amount value={balances.net} />
        </div>

        <div className="mt-3 pt-3 border-t border-[#1A1A1A]/5 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#1A1A1A]/70">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: ACCENTS.green }}
              />
              You have
            </span>
            <span className="font-medium">
              <Amount value={balances.have} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#1A1A1A]/70">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: ACCENTS.pink }}
              />
              You owe
            </span>
            <span className="font-medium">
              <Amount value={balances.owe} />
            </span>
          </div>
        </div>
      </div>
    </PrivacyContext.Provider>
  );
}
