"use client";

// Small eye button placed in a card corner to hide/reveal that box's numbers.
export default function BoxToggle({
  hidden,
  onToggle,
  className = "",
}: {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onToggle}
      title={hidden ? "Show amounts" : "Hide amounts"}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      className={`w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-sm leading-none ${className}`}
    >
      {hidden ? "🙈" : "👁️"}
    </button>
  );
}
