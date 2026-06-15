"use client";

import { usePrivacy } from "@/lib/privacy";
import { formatCurrency, formatCompact } from "@/lib/format";

// Renders a monetary value, masked when privacy mode is on.
export default function Amount({
  value,
  currency = "USD",
  compact = false,
  prefix = "",
  className,
}: {
  value: number;
  currency?: string;
  compact?: boolean;
  prefix?: string;
  className?: string;
}) {
  const { hidden } = usePrivacy();
  if (hidden) {
    return <span className={className}>{prefix}••••</span>;
  }
  const text = compact ? formatCompact(value) : formatCurrency(value, currency);
  return (
    <span className={className}>
      {prefix}
      {text}
    </span>
  );
}
