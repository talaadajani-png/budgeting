"use client";

import { useEffect, useState } from "react";
import type { Account, Transaction } from "@/lib/types";

type Props = {
  open: boolean;
  tx: Transaction | null; // null = create mode
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A]/30";

export default function TransactionEditor({ open, tx, accounts, onClose, onSaved }: Props) {
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (tx) {
      setAccountId(tx.account_id ?? "");
      setDate(tx.date ?? "");
      setDirection(tx.amount < 0 ? "in" : "out");
      setAmount(String(Math.abs(tx.amount)));
      setName(tx.name ?? "");
      setCategory(tx.category ?? "");
      setPending(Boolean(tx.pending));
    } else {
      setAccountId(accounts[0]?.id ?? "");
      setDate(new Date().toISOString().slice(0, 10));
      setDirection("out");
      setAmount("");
      setName("");
      setCategory("");
      setPending(false);
    }
  }, [open, tx, accounts]);

  if (!open) return null;

  async function save() {
    const abs = Math.abs(Number(amount));
    if (!date || !Number.isFinite(abs) || abs === 0) {
      setError("Enter a date and a non-zero amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      id: tx?.id,
      account_id: accountId || null,
      date,
      amount: direction === "out" ? abs : -abs,
      name: name.trim() || null,
      category: category.trim() || null,
      pending,
    };
    try {
      const res = await fetch("/api/transactions", {
        method: tx ? "PATCH" : "POST",
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
    if (!tx) return;
    if (!confirm("Delete this transaction?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/transactions?id=${tx.id}`, { method: "DELETE" });
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
            {tx ? "Edit transaction" : "Add transaction"}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection("out")}
              className={`rounded-xl py-2 text-sm font-medium transition ${
                direction === "out" ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]/70"
              }`}
            >
              Money out
            </button>
            <button
              onClick={() => setDirection("in")}
              className={`rounded-xl py-2 text-sm font-medium transition ${
                direction === "in" ? "bg-[#C7E3A4] text-[#1A1A1A]" : "bg-white text-[#1A1A1A]/70"
              }`}
            >
              Money in
            </button>
          </div>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Description</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Loblaws"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Category</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              placeholder="e.g. Groceries"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[#1A1A1A]/50">Account</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
            Pending (not yet posted)
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {tx ? (
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
