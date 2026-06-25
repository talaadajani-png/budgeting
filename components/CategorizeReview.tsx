"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { categorizeTransaction, vendorKey } from "@/lib/categorize";
import { formatCurrency, formatDate } from "@/lib/format";

export type ReviewItem = { date: string; name: string; amount: number; category: string | null };

type Props = {
  open: boolean;
  accountId: string;
  items: ReviewItem[];
  onBack: () => void; // return to the column-mapping step
  onDone: (result: { imported: number; skipped: number; total: number }) => void;
};

const SWIPE_THRESHOLD = 90;

export default function CategorizeReview({ open, accountId, items, onBack, onDone }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [vendorMap, setVendorMap] = useState<Map<string, string>>(new Map());
  // Per-item override: undefined = use suggestion, "" = explicit none, string = chosen.
  const [overrides, setOverrides] = useState<(string | undefined)[]>([]);
  const [index, setIndex] = useState(0);
  const [newCat, setNewCat] = useState("");
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const learned = useRef<Map<string, string>>(new Map());
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    learned.current = new Map();
    (async () => {
      const [c, v] = await Promise.all([
        fetch("/api/categories").then((r) => r.json()).catch(() => ({})),
        fetch("/api/vendor-rules").then((r) => r.json()).catch(() => ({})),
      ]);
      if (cancelled) return;
      setIndex(0);
      setOverrides(new Array(items.length).fill(undefined));
      setError(null);
      const names: string[] = (c.categories ?? []).map((x: { name: string }) => x.name);
      setCategories(names.length ? names : FALLBACK_CATEGORIES);
      const m = new Map<string, string>();
      for (const r of v.rules ?? []) m.set(r.vendor_key, r.category);
      setVendorMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  // Best guess for an item: a remembered vendor wins, then any category from the
  // CSV, then the keyword categorizer.
  const suggestionFor = useCallback(
    (i: number): string | null => {
      const item = items[i];
      if (!item) return null;
      const key = vendorKey(item.name);
      return (
        (key && vendorMap.get(key)) ||
        item.category ||
        categorizeTransaction(item.name) ||
        null
      );
    },
    [items, vendorMap]
  );

  const effective = useCallback(
    (i: number): string | null => {
      const o = overrides[i];
      if (o === undefined) return suggestionFor(i);
      return o || null;
    },
    [overrides, suggestionFor]
  );

  if (!open) return null;

  function setOverride(i: number, value: string | undefined) {
    setOverrides((prev) => {
      const next = prev.slice();
      next[i] = value;
      return next;
    });
  }

  function advance() {
    setDragX(0);
    dragStart.current = null;
    setIndex((i) => i + 1);
  }

  function approve() {
    const cat = effective(index);
    if (cat) {
      const key = vendorKey(items[index].name);
      if (key) {
        learned.current.set(key, cat);
        setVendorMap((prev) => new Map(prev).set(key, cat));
      }
    }
    advance();
  }

  function skip() {
    setOverride(index, ""); // explicit "no category"
    advance();
  }

  function approveAllRemaining() {
    for (let i = index; i < items.length; i++) {
      const cat = effective(i);
      if (cat) {
        const key = vendorKey(items[i].name);
        if (key) {
          learned.current.set(key, cat);
        }
      }
    }
    // Fold everything learned into the map for the final commit, then jump to end.
    setVendorMap((prev) => {
      const next = new Map(prev);
      for (const [k, c] of learned.current) next.set(k, c);
      return next;
    });
    setIndex(items.length);
  }

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    setNewCat("");
    if (!categories.includes(name)) setCategories((c) => [...c, name].sort());
    setOverride(index, name);
    fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  }

  async function commit() {
    setCommitting(true);
    setError(null);
    try {
      const transactions = items.map((it, i) => ({
        date: it.date,
        name: it.name,
        amount: it.amount,
        category: effective(i),
      }));
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, transactions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      // Persist everything we learned this session (best-effort, non-blocking failure).
      const rules = [...learned.current.entries()].map(([vendor_key, category]) => ({
        vendor_key,
        category,
      }));
      if (rules.length) {
        await fetch("/api/vendor-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules }),
        }).catch(() => {});
      }
      onDone({ imported: data.imported, skipped: data.skipped, total: data.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  const done = index >= items.length;
  const item = done ? null : items[index];
  const current = done ? null : effective(index);
  const remembered = item ? Boolean(vendorKey(item.name) && vendorMap.get(vendorKey(item.name) ?? "")) : false;

  // ----- Pointer/drag handlers (Tinder-style) -----
  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current == null) return;
    setDragX(e.clientX - dragStart.current);
  }
  function onPointerUp() {
    if (dragX > SWIPE_THRESHOLD) approve();
    else if (dragX < -SWIPE_THRESHOLD) skip();
    else setDragX(0);
    dragStart.current = null;
    setDragging(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={onBack}
    >
      <div
        className="bg-[#FBF9F4] rounded-3xl w-full max-w-md p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Review categories</h3>
            <p className="text-sm text-[#1A1A1A]/50">
              Swipe right to approve, left to skip. Tap a chip to change it.
            </p>
          </div>
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 flex items-center justify-center shrink-0"
            aria-label="Back"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-2xl font-bold mb-1">All reviewed 🎉</div>
            <p className="text-sm text-[#1A1A1A]/60 mb-6">
              {items.length} transaction{items.length === 1 ? "" : "s"} ready to import.
            </p>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <button
              onClick={commit}
              disabled={committing}
              className="rounded-full bg-[#1A1A1A] text-white px-6 py-2.5 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
            >
              {committing ? "Importing…" : `Import ${items.length} transactions`}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-[#1A1A1A]/40 mb-2">
              <span>{index + 1} of {items.length}</span>
              <button onClick={approveAllRemaining} className="hover:underline">
                Approve all remaining →
              </button>
            </div>

            {/* Card */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
                transition: dragging ? "none" : "transform 0.2s ease",
                touchAction: "pan-y",
              }}
              className="relative bg-white rounded-3xl border border-[#1A1A1A]/10 p-5 mb-4 cursor-grab active:cursor-grabbing select-none"
            >
              {/* swipe hints */}
              {dragX > 25 && (
                <span className="absolute top-4 left-4 text-xs font-bold text-green-600 border-2 border-green-600 rounded-lg px-2 py-0.5 rotate-[-12deg]">
                  APPROVE
                </span>
              )}
              {dragX < -25 && (
                <span className="absolute top-4 right-4 text-xs font-bold text-red-500 border-2 border-red-500 rounded-lg px-2 py-0.5 rotate-[12deg]">
                  SKIP
                </span>
              )}

              <div className="flex items-center justify-between text-xs text-[#1A1A1A]/40 mb-2">
                <span>{formatDate(item!.date)}</span>
                <span style={{ color: item!.amount < 0 ? "#5B8A2E" : "#1A1A1A" }} className="font-semibold">
                  {item!.amount < 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(item!.amount), "CAD")}
                </span>
              </div>
              <div className="font-semibold text-lg mb-3 break-words">{item!.name || "—"}</div>
              <div className="text-xs text-[#1A1A1A]/50">
                Category{remembered && <span className="ml-1 text-[#1A1A1A]/40">· remembered vendor</span>}
              </div>
              <div className="text-base font-medium" style={{ color: current ? undefined : "#1A1A1A66" }}>
                {current ?? "Uncategorized"}
              </div>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat) => {
                const active = current === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setOverride(index, cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? "bg-[#1A1A1A] text-white" : "bg-white border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/5"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Add a new category */}
            <div className="flex gap-2 mb-4">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCategory();
                }}
                placeholder="New category…"
                className="flex-1 rounded-full bg-white border border-[#1A1A1A]/10 px-3 py-1.5 text-xs outline-none focus:border-[#1A1A1A]/30"
              />
              <button
                onClick={addCategory}
                className="rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 px-3 py-1.5 text-xs font-medium"
              >
                Add
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={skip}
                className="w-14 h-14 rounded-full bg-white border border-[#1A1A1A]/10 text-2xl hover:bg-red-50 hover:border-red-200 transition"
                title="Skip (no category)"
              >
                ✗
              </button>
              <button
                onClick={approve}
                className="w-14 h-14 rounded-full bg-[#1A1A1A] text-white text-2xl hover:opacity-90 transition"
                title="Approve category"
              >
                ✓
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const FALLBACK_CATEGORIES = [
  "Groceries", "Dining", "Transport", "Shopping", "Subscriptions",
  "Bills & Utilities", "Health", "Entertainment", "Travel", "Income",
  "Transfers", "Fees", "Other",
];
