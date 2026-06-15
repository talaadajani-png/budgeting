"use client";

import { usePrivacy } from "@/lib/privacy";

export default function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  return (
    <button
      onClick={toggle}
      title={hidden ? "Show amounts" : "Hide amounts"}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      className="w-10 h-10 rounded-full bg-[#FBF9F4] hover:bg-white flex items-center justify-center text-lg"
    >
      {hidden ? "🙈" : "👁️"}
    </button>
  );
}
