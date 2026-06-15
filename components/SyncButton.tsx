"use client";

import { useState } from "react";

export default function SyncButton({ onSynced }: { onSynced?: () => void }) {
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      await fetch("/api/plaid/sync-transactions", { method: "POST" });
      onSynced?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={sync}
      disabled={busy}
      className="rounded-full bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] px-5 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-[#1A1A1A]/5 transition"
    >
      {busy ? "Syncing…" : "↻ Sync now"}
    </button>
  );
}
