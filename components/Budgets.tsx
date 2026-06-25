"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { colorForIndex } from "@/lib/colors";
import { prettyCategory } from "@/lib/format";
import Amount from "./Amount";
import PrivacyToggle from "./PrivacyToggle";
import PrivacyBox from "./PrivacyBox";
import type { Budget, Transaction } from "@/lib/types";

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");

  const load = useCallback(async () => {
    const [b, t] = await Promise.all([
      fetch("/api/budgets").then((r) => r.json()),
      fetch("/api/transactions?limit=500").then((r) => r.json()),
    ]);
    setBudgets(b.budgets ?? []);
    setTransactions(t.transactions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Spending per category this month (positive amounts = money out).
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount <= 0 || !isThisMonth(t.date)) continue;
      const key = prettyCategory(t.category);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return map;
  }, [transactions]);

  const budgetMap = useMemo(
    () => new Map(budgets.map((b) => [b.category, b.monthly_limit])),
    [budgets]
  );

  // Every category we know about: anything with spend this month, plus anything budgeted.
  const categories = useMemo(() => {
    const set = new Set<string>([...spentByCategory.keys(), ...budgetMap.keys()]);
    return [...set].sort(
      (a, b) => (spentByCategory.get(b) ?? 0) - (spentByCategory.get(a) ?? 0)
    );
  }, [spentByCategory, budgetMap]);

  const totalSpent = useMemo(
    () => [...spentByCategory.values()].reduce((s, v) => s + v, 0),
    [spentByCategory]
  );
  const totalBudget = useMemo(
    () => budgets.reduce((s, b) => s + b.monthly_limit, 0),
    [budgets]
  );

  function draftFor(cat: string): string {
    if (cat in drafts) return drafts[cat];
    const existing = budgetMap.get(cat);
    return existing != null ? String(existing) : "";
  }

  async function saveBudget(cat: string) {
    const raw = draftFor(cat);
    const limit = Number(raw);
    if (!Number.isFinite(limit) || limit < 0) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, monthly_limit: limit }),
    });
    setDrafts((d) => {
      const next = { ...d };
      delete next[cat];
      return next;
    });
    load();
  }

  async function removeBudget(cat: string) {
    await fetch(`/api/budgets?category=${encodeURIComponent(cat)}`, { method: "DELETE" });
    load();
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const cat = newCategory.trim();
    if (!cat) return;
    setDrafts((d) => ({ ...d, [cat]: d[cat] ?? "" }));
    // Make sure it shows up even with no spend yet by seeding a zero budget row.
    fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, monthly_limit: 0 }),
    }).then(() => {
      setNewCategory("");
      load();
    });
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#1A1A1A] px-4 sm:px-8 py-6">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-sm font-medium hover:opacity-70">
          ← Back to dashboard
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/categories" className="text-sm font-medium hover:opacity-70">
            Manage categories
          </Link>
          <PrivacyToggle />
        </div>
      </header>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
        Categories &amp; budgets
      </h1>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <PrivacyBox className="bg-[#FBF9F4] rounded-3xl p-5">
          <div className="text-sm text-[#1A1A1A]/50">Spent this month</div>
          <div className="text-2xl font-bold mt-1">
            <Amount value={totalSpent} />
          </div>
        </PrivacyBox>
        <PrivacyBox className="bg-[#FBF9F4] rounded-3xl p-5">
          <div className="text-sm text-[#1A1A1A]/50">Total budgeted</div>
          <div className="text-2xl font-bold mt-1">
            <Amount value={totalBudget} />
          </div>
        </PrivacyBox>
        <PrivacyBox className="bg-[#FBF9F4] rounded-3xl p-5">
          <div className="text-sm text-[#1A1A1A]/50">Remaining</div>
          <div
            className="text-2xl font-bold mt-1"
            style={{ color: totalBudget - totalSpent < 0 ? "#D06262" : undefined }}
          >
            <Amount value={totalBudget - totalSpent} />
          </div>
        </PrivacyBox>
      </div>

      {/* Add custom category */}
      <form onSubmit={addCustom} className="flex gap-2 mb-6 max-w-md">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Add a custom category…"
          className="flex-1 rounded-full bg-[#FBF9F4] border border-[#1A1A1A]/10 px-4 py-2.5 text-sm outline-none focus:border-[#1A1A1A]/30"
        />
        <button
          type="submit"
          className="rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
        >
          Add
        </button>
      </form>

      {/* Per-category list */}
      {loading ? (
        <div className="text-[#1A1A1A]/50 py-12 text-center">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="bg-[#FBF9F4] rounded-3xl p-6 text-sm text-[#1A1A1A]/50">
          No spending categories yet. Sync some transactions on the dashboard, or add
          a custom category above.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((cat, i) => {
            const spent = spentByCategory.get(cat) ?? 0;
            const hasBudget = budgetMap.has(cat);
            const limit = budgetMap.get(cat) ?? 0;
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = hasBudget && spent > limit;

            return (
              <div key={cat} className="bg-[#FBF9F4] rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{cat}</div>
                    <div className="text-sm text-[#1A1A1A]/50">
                      <Amount value={spent} /> spent
                      {hasBudget && <> · limit <Amount value={limit} /></>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#1A1A1A]/40 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draftFor(cat)}
                      placeholder="Set limit"
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [cat]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveBudget(cat);
                      }}
                      className="w-28 rounded-full bg-white border border-[#1A1A1A]/10 px-3 py-1.5 text-sm outline-none focus:border-[#1A1A1A]/30"
                    />
                    <button
                      onClick={() => saveBudget(cat)}
                      className="rounded-full bg-[#1A1A1A] text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 transition"
                    >
                      Save
                    </button>
                    {hasBudget && (
                      <button
                        onClick={() => removeBudget(cat)}
                        className="text-[#1A1A1A]/30 hover:text-red-500 text-sm px-1"
                        title="Remove budget"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {hasBudget && limit > 0 && (
                  <div className="h-3 rounded-full bg-[#1A1A1A]/5 overflow-hidden mt-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? "#E59C9C" : colorForIndex(i),
                      }}
                    />
                  </div>
                )}
                {over && (
                  <div className="text-xs text-red-500 mt-2">
                    Over budget by <Amount value={spent - limit} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
