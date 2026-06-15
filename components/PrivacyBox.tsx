"use client";

import { PrivacyContext, useBoxPrivacy } from "@/lib/privacy";
import BoxToggle from "./BoxToggle";

// A card container with its own hide/reveal toggle in the top-right corner.
// Any <Amount> rendered inside respects this box's effective privacy state.
export default function PrivacyBox({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { hidden, toggle } = useBoxPrivacy();
  return (
    <div className={`relative ${className}`} style={style}>
      <BoxToggle hidden={hidden} onToggle={toggle} className="absolute top-3 right-3 z-10" />
      <PrivacyContext.Provider value={{ hidden, toggle }}>
        {children}
      </PrivacyContext.Provider>
    </div>
  );
}
