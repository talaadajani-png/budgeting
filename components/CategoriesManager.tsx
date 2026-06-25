"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Transaction } from "@/lib/types";

function countByCategory(transactions: Transaction[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category) continue;
    m.set(t.category, (m.get(t.category) ?? 0) + 1);
  }
  return m;
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<string[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    const [c, t] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/transactions?limit=500").then((r) => r.json()),
    ]);
    return {
      names: (c.categories ?? []).map((x: { name: string }) => x.name) as string[],
      counts: countByCategory(t.transactions ?? []),
    };
  }

  const reload = useCallback(async () => {
    const { names, counts } = await fetchAll();
    setCategories(names);
    setCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { names, counts } = await fetchAll();
      if (!active) return;
      setCategories(names);
      setCounts(counts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function call(method: string, body?: unknown, query?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories${query ?? ""}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Request failed");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    setNewCat("");
    await call("POST", { name });
  }

  async function saveRename(from: string) {
    const to = editValue.trim();
    setEditing(null);
    if (!to || to === from) return;
    await call("PATCH", { from, to });
  }

  async function remove(name: string) {
    const used = counts.get(name) ?? 0;
    const msg = used
      ? `Delete "${name}"? ${used} transaction${used === 1 ? "" : "s"} will become uncategorized.`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    await call("DELETE", undefined, `?name=${encodeURIComponent(name)}`);
  }

  async function doMerge() {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    if (!confirm(`Merge "${mergeFrom}" into "${mergeTo}"? All its transactions move over and "${mergeFrom}" is removed.`))
      return;
    await call("PATCH", { from: mergeFrom, to: mergeTo });
    setMergeFrom("");
    setMergeTo("");
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#1A1A1A] px-4 sm:px-8 py-6">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-sm font-medium hover:opacity-70">
          ← Back to dashboard
        </Link>
        <Link href="/budgets" className="text-sm font-medium hover:opacity-70">
          Budgets →
        </Link>
      </header>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">Manage categories</h1>

      {/* Add */}
      <form onSubmit={addCategory} className="flex gap-2 mb-4 max-w-md">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Add a category…"
          className="flex-1 rounded-full bg-[#FBF9F4] border border-[#1A1A1A]/10 px-4 py-2.5 text-sm outline-none focus:border-[#1A1A1A]/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Merge */}
      <div className="bg-[#FBF9F4] rounded-3xl p-4 mb-6 max-w-md">
        <div className="text-sm font-medium mb-2">Merge categories</div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={mergeFrom}
            onChange={(e) => setMergeFrom(e.target.value)}
            className="rounded-full bg-white border border-[#1A1A1A]/10 px-3 py-1.5 text-sm"
          >
            <option value="">From…</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-[#1A1A1A]/40 text-sm">→</span>
          <select
            value={mergeTo}
            onChange={(e) => setMergeTo(e.target.value)}
            className="rounded-full bg-white border border-[#1A1A1A]/10 px-3 py-1.5 text-sm"
          >
            <option value="">Into…</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={doMerge}
            disabled={busy || !mergeFrom || !mergeTo || mergeFrom === mergeTo}
            className="rounded-full bg-[#1A1A1A] text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            Merge
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {/* List */}
      {loading ? (
        <div className="text-[#1A1A1A]/50 py-12 text-center">Loading…</div>
      ) : categories.length === 0 ? (
        <div className="bg-[#FBF9F4] rounded-3xl p-6 text-sm text-[#1A1A1A]/50">
          No categories yet. Add one above.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-md">
          {categories.map((cat) => {
            const used = counts.get(cat) ?? 0;
            const isEditing = editing === cat;
            return (
              <div key={cat} className="bg-[#FBF9F4] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(cat);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={() => saveRename(cat)}
                    className="flex-1 rounded-lg bg-white border border-[#1A1A1A]/10 px-2 py-1 text-sm outline-none focus:border-[#1A1A1A]/30"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cat}</div>
                    <div className="text-xs text-[#1A1A1A]/40">
                      {used} transaction{used === 1 ? "" : "s"}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditing(cat);
                      setEditValue(cat);
                    }}
                    className="text-xs text-[#1A1A1A]/50 hover:text-[#1A1A1A] px-2 py-1"
                    title="Rename"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => remove(cat)}
                    disabled={busy}
                    className="text-[#1A1A1A]/30 hover:text-red-500 text-sm px-1 disabled:opacity-50"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
