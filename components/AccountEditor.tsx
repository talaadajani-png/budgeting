"use client";

import { useEffect, useState } from "react";
import { ACCOUNT_TYPES, type Account } from "@/lib/types";

type Props = {
  open: boolean;
  account: Account | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A]/30";

export default function AccountEditor({ open, account, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("checking");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (account) {
      setName(account.name ?? "");
      setType(account.type ?? "checking");
      setBalance(String(account.current_balance ?? 0));
      setCurrency(account.iso_currency ?? "CAD");
    } else {
      setName("");
      setType("checking");
      setBalance("0");
      setCurrency("CAD");
    }
  }, [open, account]);

  if (!open) return null;

  async function save() {
    if (!name.trim()) {
      setError("Give the account a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      id: account?.id,
      name: name.trim(),
      type,
      current_balance: Number(balance) || 0,
      iso_currency: currency.trim().toUpperCase() || "CAD",
    };
    try {
      const res = await fetch("/api/accounts", {
        method: account ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!account) return;
    if (!confirm(`Delete "${account.name}" and all its transactions?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts?id=${account.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF9F4] rounded-3xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-bold tracking-tight">
            {account ? "Edit account" : "Add account"}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. RBC Chequing"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-[#1A1A1A]/50">Current balance</span>
              <input
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-[#1A1A1A]/50">Currency</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass} />
            </label>
          </div>
          <p className="text-xs text-[#1A1A1A]/40">
            For credit cards / loans, enter the amount owed as the balance.
          </p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {account ? (
              <button
                onClick={remove}
                disabled={busy}
                className="text-sm text-red-500 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full bg-[#1A1A1A] text-white px-6 py-2.5 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
