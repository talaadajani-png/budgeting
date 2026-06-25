"use client";

import { useMemo, useState } from "react";
import { parseCsv, parseAmount, normalizeDate, guessColumn, type DateFormat } from "@/lib/csv";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/lib/types";

type Props = {
  open: boolean;
  accounts: Account[];
  onClose: () => void;
  onImported: () => void;
};

const inputClass =
  "w-full rounded-xl border border-[#1A1A1A]/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A]/30";

type Built = { date: string; name: string; amount: number; category: string | null };

function ColSelect({
  headers,
  value,
  onChange,
  allowNone,
}: {
  headers: string[];
  value: number;
  onChange: (n: number) => void;
  allowNone?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass}>
      {allowNone && <option value={-1}>— none —</option>}
      {!allowNone && value === -1 && <option value={-1}>— choose —</option>}
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {h}
        </option>
      ))}
    </select>
  );
}

export default function ImportModal({ open, accounts, onClose, onImported }: Props) {
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [mode, setMode] = useState<"single" | "split">("single");
  const [dateCol, setDateCol] = useState(-1);
  const [descCol, setDescCol] = useState(-1);
  const [amountCol, setAmountCol] = useState(-1);
  const [debitCol, setDebitCol] = useState(-1);
  const [creditCol, setCreditCol] = useState(-1);
  const [categoryCol, setCategoryCol] = useState(-1);
  const [spentSign, setSpentSign] = useState<"negative" | "positive">("negative");
  const [dateFmt, setDateFmt] = useState<DateFormat>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const headers = useMemo(() => {
    if (rows.length === 0) return [];
    return hasHeader ? rows[0].map((h) => h.trim()) : rows[0].map((_, i) => `Column ${i + 1}`);
  }, [rows, hasHeader]);

  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);

    // Auto-detect columns from the header row (falls back gracefully).
    const h = parsed.length ? parsed[0].map((x) => x.trim()) : [];
    const d = guessColumn(h, ["date", "transaction date", "posting date", "posted", "date posted"]);
    const desc = guessColumn(h, ["description", "details", "name", "merchant", "memo", "payee", "transaction"]);
    const amt = guessColumn(h, ["amount", "value"]);
    const deb = guessColumn(h, ["debit", "withdrawal", "withdrawals", "money out", "debits", "out"]);
    const cred = guessColumn(h, ["credit", "deposit", "deposits", "money in", "credits", "in"]);
    const cat = guessColumn(h, ["category", "type"]);
    setDateCol(d);
    setDescCol(desc);
    setAmountCol(amt);
    setDebitCol(deb);
    setCreditCol(cred);
    setCategoryCol(cat);
    setMode(deb !== -1 && cred !== -1 ? "split" : "single");
  }

  const built = useMemo<Built[]>(() => {
    const out: Built[] = [];
    for (const r of dataRows) {
      const date = normalizeDate(r[dateCol], dateFmt);
      if (!date) continue;

      let amount: number | null = null;
      if (mode === "single") {
        const raw = parseAmount(r[amountCol]);
        if (raw == null) continue;
        // Internal convention: positive = money out.
        amount = spentSign === "negative" ? -raw : raw;
      } else {
        const d = parseAmount(r[debitCol]);
        const c = parseAmount(r[creditCol]);
        if (d == null && c == null) continue;
        amount = Math.abs(d ?? 0) - Math.abs(c ?? 0);
      }
      if (amount == null || !Number.isFinite(amount) || amount === 0) continue;

      out.push({
        date,
        name: (r[descCol] ?? "").trim(),
        amount,
        category: categoryCol >= 0 ? (r[categoryCol] ?? "").trim() || null : null,
      });
    }
    return out;
  }, [dataRows, dateCol, descCol, amountCol, debitCol, creditCol, categoryCol, mode, spentSign, dateFmt]);

  if (!open) return null;

  async function doImport() {
    if (!accountId) {
      setError("Choose which account this statement belongs to.");
      return;
    }
    if (built.length === 0) {
      setError("No valid rows — check your column mapping below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, transactions: built }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult({ imported: data.imported, skipped: data.skipped, total: data.total });
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF9F4] rounded-3xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Import statement</h3>
            <p className="text-sm text-[#1A1A1A]/50">
              Upload a CSV exported from your bank. Re-uploading overlapping statements won&apos;t create duplicates.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 flex items-center justify-center shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <div className="text-3xl font-bold mb-2">✓ Imported</div>
            <p className="text-sm text-[#1A1A1A]/60">
              {result.imported} added{result.skipped > 0 ? `, ${result.skipped} already there` : ""} (of {result.total} rows).
            </p>
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={reset} className="rounded-full bg-white border border-[#1A1A1A]/10 px-5 py-2.5 text-sm font-medium">
                Import another
              </button>
              <button onClick={onClose} className="rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-sm font-medium">
                Done
              </button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-4">
            {accounts.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                Tip: add an account first so you can assign the statement to it.
              </p>
            )}
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#1A1A1A]/15 rounded-2xl py-12 cursor-pointer hover:border-[#1A1A1A]/30 transition">
              <span className="text-3xl">📄</span>
              <span className="text-sm font-medium">Choose a CSV file</span>
              <span className="text-xs text-[#1A1A1A]/40">exported from your online banking</span>
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#1A1A1A]/60 truncate">📄 {fileName} · {dataRows.length} rows</span>
              <button onClick={reset} className="text-[#1A1A1A]/50 hover:underline">
                Change file
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-[#1A1A1A]/50">Import into account</span>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
                  <option value="">— choose —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-sm pb-2">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                First row is a header
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-[#1A1A1A]/50">Date column</span>
                <ColSelect headers={headers} value={dateCol} onChange={setDateCol} />
              </label>
              <label className="block">
                <span className="text-xs text-[#1A1A1A]/50">Date format</span>
                <select value={dateFmt} onChange={(e) => setDateFmt(e.target.value as DateFormat)} className={inputClass}>
                  <option value="auto">Auto-detect</option>
                  <option value="ymd">YYYY-MM-DD</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="dmy">DD/MM/YYYY</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-[#1A1A1A]/50">Description column</span>
                <ColSelect headers={headers} value={descCol} onChange={setDescCol} />
              </label>
              <label className="block">
                <span className="text-xs text-[#1A1A1A]/50">Category column (optional)</span>
                <ColSelect headers={headers} value={categoryCol} onChange={setCategoryCol} allowNone />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("single")}
                className={`rounded-xl py-2 text-sm font-medium transition ${
                  mode === "single" ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]/70"
                }`}
              >
                One amount column
              </button>
              <button
                onClick={() => setMode("split")}
                className={`rounded-xl py-2 text-sm font-medium transition ${
                  mode === "split" ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]/70"
                }`}
              >
                Separate debit / credit
              </button>
            </div>

            {mode === "single" ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[#1A1A1A]/50">Amount column</span>
                  <ColSelect headers={headers} value={amountCol} onChange={setAmountCol} />
                </label>
                <label className="block">
                  <span className="text-xs text-[#1A1A1A]/50">In my file, money spent shows as</span>
                  <select value={spentSign} onChange={(e) => setSpentSign(e.target.value as "negative" | "positive")} className={inputClass}>
                    <option value="negative">Negative numbers (-50.00)</option>
                    <option value="positive">Positive numbers (50.00)</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-[#1A1A1A]/50">Debit (money out) column</span>
                  <ColSelect headers={headers} value={debitCol} onChange={setDebitCol} />
                </label>
                <label className="block">
                  <span className="text-xs text-[#1A1A1A]/50">Credit (money in) column</span>
                  <ColSelect headers={headers} value={creditCol} onChange={setCreditCol} />
                </label>
              </div>
            )}

            {/* Preview */}
            <div>
              <div className="text-xs text-[#1A1A1A]/50 mb-1">
                Preview — {built.length} valid {built.length === 1 ? "row" : "rows"}
              </div>
              <div className="rounded-xl border border-[#1A1A1A]/10 overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="text-[#1A1A1A]/40">
                    <tr>
                      <th className="text-left font-normal px-3 py-2">Date</th>
                      <th className="text-left font-normal px-3 py-2">Description</th>
                      <th className="text-right font-normal px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {built.slice(0, 6).map((b, i) => (
                      <tr key={i} className="border-t border-[#1A1A1A]/5">
                        <td className="px-3 py-1.5 whitespace-nowrap text-[#1A1A1A]/60">{b.date}</td>
                        <td className="px-3 py-1.5 max-w-[240px] truncate">{b.name || "—"}</td>
                        <td
                          className="px-3 py-1.5 text-right whitespace-nowrap font-medium"
                          style={{ color: b.amount < 0 ? "#5B8A2E" : "#1A1A1A" }}
                        >
                          {b.amount < 0 ? "+" : "-"}
                          {formatCurrency(Math.abs(b.amount), "CAD")}
                        </td>
                      </tr>
                    ))}
                    {built.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-[#1A1A1A]/40">
                          No valid rows with this mapping. Adjust the columns above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#1A1A1A]/40 mt-1">
                Green = money in, dark = money out. Check a couple of rows look right before importing.
              </p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end">
              <button
                onClick={doImport}
                disabled={busy || built.length === 0}
                className="rounded-full bg-[#1A1A1A] text-white px-6 py-2.5 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
              >
                {busy ? "Importing…" : `Import ${built.length} transactions`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
